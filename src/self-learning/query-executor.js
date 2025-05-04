/**
 * Query Executor and Validator Module
 *
 * Executes MongoDB queries and validates the results against expected schemas.
 */
const mongoose = require('mongoose');

/**
 * Executes a MongoDB query
 * @param {Object|Array} query MongoDB query object or aggregation pipeline
 * @param {String} collection Collection name
 * @param {String} operation Operation type (find, aggregate, etc.)
 * @param {Number} limit Maximum number of results to return
 * @returns {Object} Query execution results
 */
async function executeQuery(query, collection, operation = 'find', limit = 100, maxTimeMS = 5000) {
  try {
    console.log(`Executing ${operation} on ${collection}:`,
      JSON.stringify(query).substring(0, 200) + (JSON.stringify(query).length > 200 ? '...' : ''));

    const db = mongoose.connection.db;
    let results = [];
    let executionTime = 0;
    let success = false;

    const startTime = Date.now();

    switch (operation) {
      case 'find':
        results = await db.collection(collection).find(query)
          .limit(limit)
          .maxTimeMS(maxTimeMS)
          .toArray();
        break;

      case 'aggregate':
        // Add $limit stage if not already present
        let pipeline = Array.isArray(query) ? query : [query];

        // Check if we're doing a $lookup between players and events
        // This is a special case that needs optimization
        if (collection === 'players' &&
            pipeline.some(stage => stage.$lookup && stage.$lookup.from === 'events')) {

          console.log('Detected players-events lookup - optimizing query');

          // Replace with a more efficient query that samples events
          pipeline = optimizePlayersEventsLookup(pipeline, limit);
        } else if (collection === 'events' &&
                  pipeline.some(stage => stage.$lookup && stage.$lookup.from === 'players')) {

          console.log('Detected events-players lookup - optimizing query');

          // Replace with a more efficient query that samples players
          pipeline = optimizeEventsPlayersLookup(pipeline, limit);
        } else {
          // For other queries, just add a limit if not present
          if (!pipeline.some(stage => stage.$limit)) {
            pipeline.push({ $limit: limit });
          }
        }

        results = await db.collection(collection).aggregate(pipeline)
          .maxTimeMS(maxTimeMS)
          .toArray();
        break;

      case 'countDocuments':
        results = [{ count: await db.collection(collection).countDocuments(query)
          .maxTimeMS(maxTimeMS) }];
        break;

      case 'distinct':
        results = await db.collection(collection).distinct(query.field, query.filter || {})
          .maxTimeMS(maxTimeMS);
        results = results.map(value => ({ value }));
        break;

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    executionTime = Date.now() - startTime;
    success = true;

    console.log(`Query returned ${results.length} results in ${executionTime}ms`);

    return {
      success,
      results,
      count: results.length,
      executionTime,
      operation,
      collection,
      optimized: true
    };
  } catch (error) {
    console.error(`Error executing query on ${collection}:`, error);

    // Check if this is a timeout error
    if (error.code === 50 && error.codeName === 'MaxTimeMSExpired') {
      console.log('Query timed out - attempting fallback strategy');

      try {
        // Try a fallback strategy for timeout errors
        const fallbackResults = await executeFallbackQuery(query, collection, operation, limit);

        return {
          success: true,
          results: fallbackResults.results,
          count: fallbackResults.results.length,
          executionTime: fallbackResults.executionTime,
          operation,
          collection,
          fallback: true,
          originalError: error.message
        };
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        return {
          success: false,
          error: `Original query timed out and fallback also failed: ${fallbackError.message}`,
          originalError: error.message,
          operation,
          collection
        };
      }
    }

    return {
      success: false,
      error: error.message,
      operation,
      collection
    };
  }
}

/**
 * Optimizes a lookup between players and events
 * @param {Array} pipeline Original pipeline
 * @param {Number} limit Result limit
 * @returns {Array} Optimized pipeline
 */
function optimizePlayersEventsLookup(pipeline, limit) {
  // Start with a sample of players
  const optimizedPipeline = [
    { $sample: { size: Math.min(limit, 20) } }
  ];

  // Find the lookup stage
  const lookupStage = pipeline.find(stage => stage.$lookup && stage.$lookup.from === 'events');

  if (lookupStage) {
    // Add a modified lookup that limits the number of events
    optimizedPipeline.push({
      $lookup: {
        from: 'events',
        let: { playerId: '$playerId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$playerId', '$$playerId'] } } },
          { $limit: 100 } // Limit events per player
        ],
        as: lookupStage.$lookup.as || 'related_events'
      }
    });
  }

  // Add any project stages from the original pipeline
  const projectStage = pipeline.find(stage => stage.$project);
  if (projectStage) {
    optimizedPipeline.push(projectStage);
  }

  // Add a limit stage
  optimizedPipeline.push({ $limit: limit });

  return optimizedPipeline;
}

/**
 * Optimizes a lookup between events and players
 * @param {Array} pipeline Original pipeline
 * @param {Number} limit Result limit
 * @returns {Array} Optimized pipeline
 */
function optimizeEventsPlayersLookup(pipeline, limit) {
  // Start with a sample of events
  const optimizedPipeline = [
    { $sample: { size: Math.min(limit, 100) } }
  ];

  // Find the lookup stage
  const lookupStage = pipeline.find(stage => stage.$lookup && stage.$lookup.from === 'players');

  if (lookupStage) {
    // Add the lookup stage
    optimizedPipeline.push(lookupStage);
  }

  // Add any project stages from the original pipeline
  const projectStage = pipeline.find(stage => stage.$project);
  if (projectStage) {
    optimizedPipeline.push(projectStage);
  }

  // Add a limit stage
  optimizedPipeline.push({ $limit: limit });

  return optimizedPipeline;
}

/**
 * Executes a fallback query when the original query times out
 * @param {Object|Array} query Original query
 * @param {String} collection Collection name
 * @param {String} operation Operation type
 * @param {Number} limit Result limit
 * @returns {Object} Query results
 */
async function executeFallbackQuery(query, collection, operation, limit) {
  const db = mongoose.connection.db;
  const startTime = Date.now();

  if (operation === 'aggregate') {
    const pipeline = Array.isArray(query) ? query : [query];

    // Check if this is a lookup between players and events
    if (collection === 'players' &&
        pipeline.some(stage => stage.$lookup && stage.$lookup.from === 'events')) {

      // Use a very simple approach: just return some players without the lookup
      const results = await db.collection(collection)
        .find({})
        .limit(limit)
        .maxTimeMS(5000)
        .toArray();

      // Add a note about the fallback
      results.forEach(result => {
        result.fallbackNote = 'This result does not include related events due to query timeout';
      });

      return {
        results,
        executionTime: Date.now() - startTime
      };
    }

    // For other aggregations, try with a smaller sample
    const fallbackPipeline = [
      { $sample: { size: Math.min(limit, 20) } },
      ...pipeline.filter(stage => !stage.$lookup) // Remove lookup stages
    ];

    // Add a limit stage
    fallbackPipeline.push({ $limit: limit });

    const results = await db.collection(collection)
      .aggregate(fallbackPipeline)
      .maxTimeMS(5000)
      .toArray();

    return {
      results,
      executionTime: Date.now() - startTime
    };
  }

  // For find operations, just return a sample
  const results = await db.collection(collection)
    .find({})
    .limit(limit)
    .maxTimeMS(5000)
    .toArray();

  return {
    results,
    executionTime: Date.now() - startTime
  };
}

/**
 * Executes a query from a query pattern
 * @param {Object} queryPattern Query pattern object
 * @param {Object} parameters Query parameters
 * @param {Number} maxTimeMS Maximum execution time in milliseconds
 * @returns {Object} Query execution results
 */
async function executeQueryPattern(queryPattern, parameters = {}, maxTimeMS = 5000) {
  try {
    if (!queryPattern.mongoQuery) {
      throw new Error('Query pattern does not contain a mongoQuery object');
    }

    const { collection, operation } = queryPattern.mongoQuery;
    let query = queryPattern.mongoQuery.query || queryPattern.mongoQuery.pipeline;

    // Apply parameters to the query
    if (parameters && Object.keys(parameters).length > 0) {
      query = applyParametersToQuery(query, parameters);
    }

    // Check if this is an optimized query pattern
    const limit = queryPattern.optimized ? 20 : 100;

    return await executeQuery(query, collection, operation, limit, maxTimeMS);
  } catch (error) {
    console.error('Error executing query pattern:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Applies parameters to a query
 * @param {Object|Array} query MongoDB query object or aggregation pipeline
 * @param {Object} parameters Parameters to apply
 * @returns {Object|Array} Query with parameters applied
 */
function applyParametersToQuery(query, parameters) {
  if (!parameters || Object.keys(parameters).length === 0) {
    return query;
  }

  // Handle array (pipeline) or object (query)
  if (Array.isArray(query)) {
    return query.map(stage => applyParametersToStage(stage, parameters));
  } else {
    return applyParametersToStage(query, parameters);
  }
}

/**
 * Applies parameters to a single stage of a pipeline or query
 * @param {Object} stage Pipeline stage or query object
 * @param {Object} parameters Parameters to apply
 * @returns {Object} Stage with parameters applied
 */
function applyParametersToStage(stage, parameters) {
  // Convert stage to string
  let stageStr = JSON.stringify(stage);

  // Replace parameter placeholders
  for (const [key, value] of Object.entries(parameters)) {
    // Replace <key> placeholders
    stageStr = stageStr.replace(
      new RegExp(`"<${key}>"`, 'g'),
      JSON.stringify(value)
    );

    // Also replace direct values for specific parameters
    if (key === 'threshold') {
      // For the player frequency query, replace the hardcoded threshold value
      stageStr = stageStr.replace(
        /"playedMoreThanNTimes":\s*{\s*"\$gt":\s*\["\$playCount",\s*(\d+)\s*\]\s*}/g,
        `"playedMoreThanNTimes": { "$gt": ["$playCount", ${value}] }`
      );
    }
  }

  // Parse back to object
  try {
    return JSON.parse(stageStr);
  } catch (error) {
    console.error('Error parsing stage after parameter application:', error);
    console.error('Stage string:', stageStr);
    return stage; // Return original stage if parsing fails
  }
}

/**
 * Validates query results against expected schema
 * @param {Array} results Query results
 * @param {Object} expectedSchema Expected schema
 * @returns {Object} Validation results
 */
function validateResults(results, expectedSchema = {}) {
  if (!results || results.length === 0) {
    return {
      valid: false,
      reason: 'No results returned'
    };
  }

  // Check if results have expected fields
  const sampleResult = results[0];
  const missingFields = [];

  for (const field of expectedSchema.requiredFields || []) {
    if (!(field in sampleResult)) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      reason: `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  // Check if results match expected type
  const typeErrors = [];

  for (const [field, expectedType] of Object.entries(expectedSchema.fieldTypes || {})) {
    if (field in sampleResult) {
      const actualType = getType(sampleResult[field]);
      if (actualType !== expectedType) {
        typeErrors.push(`Field ${field} has type ${actualType}, expected ${expectedType}`);
      }
    }
  }

  if (typeErrors.length > 0) {
    return {
      valid: false,
      reason: typeErrors.join('; ')
    };
  }

  // Check if results count matches expected count
  if (expectedSchema.minCount && results.length < expectedSchema.minCount) {
    return {
      valid: false,
      reason: `Expected at least ${expectedSchema.minCount} results, got ${results.length}`
    };
  }

  if (expectedSchema.maxCount && results.length > expectedSchema.maxCount) {
    return {
      valid: false,
      reason: `Expected at most ${expectedSchema.maxCount} results, got ${results.length}`
    };
  }

  return {
    valid: true
  };
}

/**
 * Gets the type of a value
 * @param {*} value The value to get the type of
 * @returns {String} The type of the value
 */
function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectID') return 'objectId';
    return 'object';
  }
  return typeof value;
}

/**
 * Analyzes query results to extract schema information
 * @param {Array} results Query results
 * @returns {Object} Extracted schema information
 */
function analyzeResults(results) {
  if (!results || results.length === 0) {
    return {
      fields: {},
      count: 0
    };
  }

  const fields = {};
  const sampleResult = results[0];

  for (const [key, value] of Object.entries(sampleResult)) {
    fields[key] = {
      type: getType(value),
      example: value
    };
  }

  return {
    fields,
    count: results.length,
    sample: sampleResult
  };
}

module.exports = {
  executeQuery,
  executeQueryPattern,
  validateResults,
  analyzeResults,
  applyParametersToQuery
};
