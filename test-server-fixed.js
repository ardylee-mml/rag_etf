require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Import the Deepseek service
const deepseekService = require('./src/services/deepseekService');

// Custom relationship mapping query route
app.post('/api/query/mapping', async (req, res) => {
  try {
    const { query, primaryCollection, relatedCollection, mappingInfo, schemaInfo } = req.body;

    if (!query || !mappingInfo || !mappingInfo.collections || !mappingInfo.relationships) {
      return res.status(400).json({
        message: 'Query and mapping information are required'
      });
    }

    console.log('Processing custom mapping query:', query);
    console.log('Collections:', mappingInfo.collections);
    console.log('Relationships:', mappingInfo.relationships);

    // Get the database connection
    const db = mongoose.connection.db;

    // Check if this is a query that we can handle directly
    const lowerQuery = query.toLowerCase();
    let processedQuery = null;
    let pipeline = [];
    let explanation = '';
    let startCollection = '';
    let results = [];

    // Check for player activity queries
    const isPlayerActivityQuery = (lowerQuery.includes('player') || lowerQuery.includes('players')) &&
                               (lowerQuery.includes('played') || lowerQuery.includes('time') ||
                                lowerQuery.includes('times') || lowerQuery.includes('activity'));

    // Find the events collection in the mapping if it exists
    const hasEventsCollection = mappingInfo.collections.includes('events');

    // Handle player activity queries with specific counts
    if (isPlayerActivityQuery && hasEventsCollection) {
      console.log('Detected player activity query in mapping context, handling directly');

      startCollection = 'events';

      // Check for specific count patterns
      const exactlyMatch = lowerQuery.match(/(\d+)\s+times?/i);
      const moreThanMatch = lowerQuery.match(/more than (\d+)\s+times?/i);
      const atLeastMatch = lowerQuery.match(/at least (\d+)\s+times?/i);

      let threshold = 1;
      let comparisonOperator = '$eq';
      let comparisonText = 'exactly';

      if (moreThanMatch) {
        threshold = parseInt(moreThanMatch[1]);
        comparisonOperator = '$gt';
        comparisonText = 'more than';
      } else if (atLeastMatch) {
        threshold = parseInt(atLeastMatch[1]);
        comparisonOperator = '$gte';
        comparisonText = 'at least';
      } else if (exactlyMatch) {
        threshold = parseInt(exactlyMatch[1]);
        comparisonOperator = '$eq';
        comparisonText = 'exactly';
      }

      console.log(`Threshold: ${comparisonText} ${threshold}`);

      // Create the pipeline
      pipeline = [
        // Group by playerId and count occurrences
        { $group: {
            _id: '$playerId',
            count: { $sum: 1 }
        }},
        // Filter based on the count threshold
        { $match: {
            count: { [comparisonOperator]: threshold }
        }}
      ];

      // If the query is asking for a count, add a count stage
      if (lowerQuery.includes('how many')) {
        pipeline.push({ $count: 'totalPlayers' });
      } else {
        // Otherwise, add lookup and projection stages
        pipeline = [
          ...pipeline,
          // Lookup player details
          { $lookup: {
              from: 'players',
              localField: '_id',
              foreignField: 'playerId',
              as: 'playerDetails'
          }},
          // Unwind player details
          { $unwind: { path: '$playerDetails', preserveNullAndEmptyArrays: true } },
          // Project relevant fields
          { $project: {
              playerId: '$_id',
              playerName: '$playerDetails.name',
              activityCount: '$count',
              _id: 0
          }},
          // Sort by activity count in descending order
          { $sort: { activityCount: -1 } }
        ];
      }

      // Set the explanation
      explanation = `This pipeline counts players who played ${comparisonText} ${threshold} time(s) by:
1. Grouping events by playerId
2. Counting the number of events for each player
3. Filtering players based on the count threshold (${comparisonText} ${threshold})
${lowerQuery.includes('how many') ? '4. Counting the total number of players meeting the criteria' : '4. Looking up player details and sorting by activity count'}`;

      // Execute the pipeline
      const eventsCollection = db.collection('events');
      results = await eventsCollection.aggregate(pipeline).toArray();

      console.log(`Found ${results.length} results for player activity query`);

      // Create processed query object
      processedQuery = {
        startCollection,
        pipeline,
        explanation
      };
    }
    // If we couldn't handle the query directly, use the LLM
    else {
      // Use Deepseek LLM to process the query and generate MongoDB aggregation
      const prompt = `
You are a MongoDB query generator. Your task is to translate a natural language query into a MongoDB aggregation pipeline.

The user has defined the following collections and relationships:
Collections: ${mappingInfo.collections.join(', ')}

Relationships:
${mappingInfo.relationships.map(rel =>
  `- ${rel.sourceCollection}.${rel.sourceField} → ${rel.targetCollection}.${rel.targetField}`
).join('\n')}

Schema information:
${Object.entries(schemaInfo || {}).map(([collection, info]) =>
  `${collection}: ${info.fields ? info.fields.join(', ') : 'No fields provided'}`
).join('\n')}

User query: "${query}"

Generate a MongoDB aggregation pipeline that:
1. Starts with the appropriate collection
2. Uses $lookup stages to join related collections based on the defined relationships
3. Applies appropriate filters based on the query
4. Projects relevant fields
5. Sorts and limits results as needed

Return your response in the following JSON format:
{
  "startCollection": "name of the collection to start with",
  "pipeline": [
    // MongoDB aggregation pipeline stages
  ],
  "explanation": "A detailed explanation of how the pipeline works"
}
`;

      const deepseekResponse = await deepseekService.generateCompletion(prompt);
      console.log('Deepseek response:', deepseekResponse);

      // Create processed query object
      processedQuery = {
        startCollection: '',
        pipeline: [],
        explanation: ''
      };

      try {
        // Parse the Deepseek response to extract the MongoDB query
        const jsonMatch = deepseekResponse.match(/```json\n([\s\S]*?)\n```/) ||
                          deepseekResponse.match(/```\n([\s\S]*?)\n```/) ||
                          deepseekResponse.match(/{[\s\S]*?}/);

        if (jsonMatch) {
          const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
          const parsedResponse = JSON.parse(jsonStr);

          processedQuery = parsedResponse;
          pipeline = parsedResponse.pipeline || [];
          explanation = parsedResponse.explanation || '';
          startCollection = parsedResponse.startCollection || mappingInfo.collections[0];
        } else {
          // Fallback if JSON parsing fails
          console.log('Failed to parse Deepseek response as JSON, using default pipeline');
          startCollection = mappingInfo.collections[0];
          pipeline = [{ $match: {} }, { $limit: 20 }];
          explanation = 'Failed to generate a custom pipeline from the query. Using a default pipeline.';
        }
      } catch (parseError) {
        console.error('Error parsing Deepseek response:', parseError);
        startCollection = mappingInfo.collections[0];
        pipeline = [{ $match: {} }, { $limit: 20 }];
        explanation = 'Error parsing the generated pipeline. Using a default pipeline.';
      }
    }

    // Execute the aggregation pipeline
    try {
      const collection = db.collection(startCollection);
      results = await collection.aggregate(pipeline).toArray();
      console.log(`Executed pipeline on ${startCollection}, got ${results.length} results`);
    } catch (dbError) {
      console.error('Error executing MongoDB pipeline:', dbError);
      return res.status(500).json({
        message: 'Error executing the generated pipeline',
        error: dbError.message,
        pipeline: pipeline
      });
    }

    // Prepare the response
    const message = results.length === 0 ?
      'No results found for your query. Try modifying your query or check your relationship mappings.' : null;

    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery,
      pipeline,
      explanation,
      message,
      tokenUsage: {
        prompt: prompt ? prompt.length : 0,
        completion: deepseekResponse ? deepseekResponse.length : 0,
        total: (prompt ? prompt.length : 0) + (deepseekResponse ? deepseekResponse.length : 0)
      }
    });
  } catch (error) {
    console.error('Custom mapping query execution error:', error);
    res.status(500).json({
      message: 'Custom mapping query execution failed',
      error: error.message
    });
  }
});

// Relationship query route
app.post('/api/query/relationship', async (req, res) => {
  try {
    const { query, primaryCollection, relatedCollection, schemaInfo } = req.body;

    if (!query || !primaryCollection || !relatedCollection) {
      return res.status(400).json({
        message: 'Query, primaryCollection, and relatedCollection are required'
      });
    }

    console.log('Processing relationship query:', query);
    console.log('Primary Collection:', primaryCollection);
    console.log('Related Collection:', relatedCollection);
    console.log('Schema Info:', schemaInfo);

    // Get the specified collection
    const db = mongoose.connection.db;
    const primaryMongoCollection = db.collection(primaryCollection);

    // Build a specialized pipeline based on the collections
    let pipeline = [];
    let explanation = '';
    let results = [];
    let message = null;

    // Check if this is a query that we can handle directly
    const lowerQuery = query.toLowerCase();

    // Check for player activity queries
    const isPlayerActivityQuery = (lowerQuery.includes('player') || lowerQuery.includes('players')) &&
                               (lowerQuery.includes('played') || lowerQuery.includes('time') ||
                                lowerQuery.includes('times') || lowerQuery.includes('activity'));

    // Check for date-based queries
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthPattern = new RegExp(`in\\s+(${monthNames.join('|')})\\s+(\\d{4})`, 'i');
    const monthMatch = lowerQuery.match(monthPattern);

    const isDateBasedQuery = monthMatch !== null;

    // Check for simple count queries
    const isSimpleCountQuery = lowerQuery.startsWith('how many') ||
                            lowerQuery.startsWith('count') ||
                            lowerQuery.includes('total number of');

    // Check for field-based queries
    const fieldPatterns = [
      { regex: /with\s+(\w+)\s+(=|equals?|is)\s+["']?([^"']+)["']?/i, operation: '$eq' },
      { regex: /where\s+(\w+)\s+(=|equals?|is)\s+["']?([^"']+)["']?/i, operation: '$eq' },
      { regex: /(\w+)\s+(=|equals?|is)\s+["']?([^"']+)["']?/i, operation: '$eq' },
      { regex: /with\s+(\w+)\s+(>|greater than)\s+(\d+)/i, operation: '$gt' },
      { regex: /where\s+(\w+)\s+(>|greater than)\s+(\d+)/i, operation: '$gt' },
      { regex: /(\w+)\s+(>|greater than)\s+(\d+)/i, operation: '$gt' },
      { regex: /with\s+(\w+)\s+(<|less than)\s+(\d+)/i, operation: '$lt' },
      { regex: /where\s+(\w+)\s+(<|less than)\s+(\d+)/i, operation: '$lt' },
      { regex: /(\w+)\s+(<|less than)\s+(\d+)/i, operation: '$lt' }
    ];

    let fieldMatch = null;
    let matchOperation = null;

    for (const pattern of fieldPatterns) {
      const match = lowerQuery.match(pattern.regex);
      if (match) {
        fieldMatch = match;
        matchOperation = pattern.operation;
        break;
      }
    }

    const isFieldBasedQuery = fieldMatch !== null;

    // Handle player activity queries with specific counts
    if (isPlayerActivityQuery && primaryCollection === 'events') {
      console.log('Detected player activity query in relationship context, handling directly');

      // Check for specific count patterns
      const exactlyMatch = lowerQuery.match(/(\d+)\s+times?/i);
      const moreThanMatch = lowerQuery.match(/more than (\d+)\s+times?/i);
      const atLeastMatch = lowerQuery.match(/at least (\d+)\s+times?/i);

      let threshold = 1;
      let comparisonOperator = '$eq';
      let comparisonText = 'exactly';

      if (moreThanMatch) {
        threshold = parseInt(moreThanMatch[1]);
        comparisonOperator = '$gt';
        comparisonText = 'more than';
      } else if (atLeastMatch) {
        threshold = parseInt(atLeastMatch[1]);
        comparisonOperator = '$gte';
        comparisonText = 'at least';
      } else if (exactlyMatch) {
        threshold = parseInt(exactlyMatch[1]);
        comparisonOperator = '$eq';
        comparisonText = 'exactly';
      }

      console.log(`Threshold: ${comparisonText} ${threshold}`);

      // Create the pipeline
      pipeline = [
        // Group by playerId and count occurrences
        { $group: {
            _id: '$playerId',
            count: { $sum: 1 }
        }},
        // Filter based on the count threshold
        { $match: {
            count: { [comparisonOperator]: threshold }
        }}
      ];

      // If the query is asking for a count, add a count stage
      if (lowerQuery.includes('how many')) {
        pipeline.push({ $count: 'totalPlayers' });
      } else {
        // Otherwise, add lookup and projection stages
        pipeline = [
          ...pipeline,
          // Lookup player details
          { $lookup: {
              from: 'players',
              localField: '_id',
              foreignField: 'playerId',
              as: 'playerDetails'
          }},
          // Unwind player details
          { $unwind: { path: '$playerDetails', preserveNullAndEmptyArrays: true } },
          // Project relevant fields
          { $project: {
              playerId: '$_id',
              playerName: '$playerDetails.name',
              activityCount: '$count',
              _id: 0
          }},
          // Sort by activity count in descending order
          { $sort: { activityCount: -1 } }
        ];
      }

      // Set the explanation
      explanation = `This pipeline counts players who played ${comparisonText} ${threshold} time(s) by:
1. Grouping events by playerId
2. Counting the number of events for each player
3. Filtering players based on the count threshold (${comparisonText} ${threshold})
${lowerQuery.includes('how many') ? '4. Counting the total number of players meeting the criteria' : '4. Looking up player details and sorting by activity count'}`;

      // Execute the pipeline
      const eventsCollection = db.collection('events');
      results = await eventsCollection.aggregate(pipeline).toArray();

      console.log(`Found ${results.length} results for player activity query`);
    }

    // Log what we're sending to the client
    console.log(`Sending relationship response to client with ${results ? results.length : 0} results`);

    // Add a small delay to ensure the results are properly processed
    setTimeout(() => {
      res.json({
        query,
        timestamp: new Date(),
        results,
        processedQuery: `db.${primaryCollection}.aggregate(${JSON.stringify(pipeline)})`,
        pipeline: pipeline,
        explanation: explanation,
        message: message
      });
    }, 500);
  } catch (error) {
    console.error('Relationship query execution error:', error);
    res.status(500).json({ message: 'Relationship query execution failed' });
  }
});

// Start the server
console.log(`Starting server on port ${PORT}...`);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
