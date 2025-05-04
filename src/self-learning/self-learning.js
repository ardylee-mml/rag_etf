/**
 * Self-Learning Schema Analysis and Query Generation System
 *
 * Main script that orchestrates the self-learning process:
 * 1. Analyzes database schema
 * 2. Discovers relationships between collections
 * 3. Generates query patterns
 * 4. Generates natural language questions
 * 5. Executes and validates queries
 * 6. Saves results for use by the main system
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

const { analyzeSchema } = require('./schema-analyzer');
const { discoverRelationships } = require('./relationship-discoverer');
const { generateQueryPatterns } = require('./query-pattern-generator');
const { generateQuestions } = require('./question-generator');
const { executeQueryPattern, validateResults } = require('./query-executor');

/**
 * Runs the self-learning process
 * @param {Object} options Configuration options
 * @returns {Object} Results of the self-learning process
 */
async function runSelfLearning(options = {}) {
  const defaultOptions = {
    outputDir: path.join(__dirname, '..', '..', 'data', 'self-learning'),
    validateQueries: true,
    sampleSize: 10,
    collections: ['players', 'events', 'items', 'zones', 'questions', 'leaderboards'],
    maxTimeMS: 10000, // 10 seconds timeout for queries
    skipLargeCollections: false, // Set to true to skip large collections like events
    maxQueryRetries: 2 // Number of times to retry a failed query
  };

  const config = { ...defaultOptions, ...options };

  try {
    console.log('Starting self-learning process...');

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    }

    // Step 1: Analyze schema
    console.log('Step 1: Analyzing schema...');
    const schemaInfo = await analyzeSchema();
    console.log(`Analyzed ${Object.keys(schemaInfo).length} collections`);

    // Step 2: Discover relationships
    console.log('Step 2: Discovering relationships...');
    const relationships = await discoverRelationships(schemaInfo);
    console.log(`Discovered ${relationships.length} relationships`);

    // Step 3: Generate query patterns
    console.log('Step 3: Generating query patterns...');
    const queryPatterns = generateQueryPatterns(schemaInfo, relationships);
    console.log(`Generated ${queryPatterns.length} query patterns`);

    // Step 4: Generate questions
    console.log('Step 4: Generating questions...');
    const questions = generateQuestions(schemaInfo, relationships, queryPatterns);
    console.log(`Generated ${questions.length} questions`);

    // Step 5: Execute and validate queries
    console.log('Step 5: Executing and validating queries...');
    const validatedQuestions = [];
    let successfulQueries = 0;
    let failedQueries = 0;
    let timeoutQueries = 0;
    let optimizedQueries = 0;

    if (config.validateQueries) {
      // Group questions by collection to better manage resources
      const questionsByCollection = {};

      for (const question of questions) {
        if (question.queryPattern && question.queryPattern.collection) {
          const collection = question.queryPattern.collection;
          if (!questionsByCollection[collection]) {
            questionsByCollection[collection] = [];
          }
          questionsByCollection[collection].push(question);
        } else if (question.collections && question.collections.length > 0) {
          const collection = question.collections[0];
          if (!questionsByCollection[collection]) {
            questionsByCollection[collection] = [];
          }
          questionsByCollection[collection].push(question);
        } else {
          // Questions without a specific collection
          if (!questionsByCollection['other']) {
            questionsByCollection['other'] = [];
          }
          questionsByCollection['other'].push(question);
        }
      }

      // Process questions by collection
      for (const collection in questionsByCollection) {
        console.log(`Processing ${questionsByCollection[collection].length} questions for collection: ${collection}`);

        // Skip large collections if configured to do so
        if (config.skipLargeCollections &&
            (collection === 'events' || collection === 'players')) {
          console.log(`Skipping large collection: ${collection}`);

          // Mark questions as skipped
          for (const question of questionsByCollection[collection]) {
            question.execution = {
              success: false,
              skipped: true,
              reason: `Skipped large collection: ${collection}`
            };
            validatedQuestions.push(question);
          }

          continue;
        }

        // Process questions for this collection
        for (const question of questionsByCollection[collection]) {
          console.log(`Testing question: "${question.text}"`);

          if (question.queryPattern) {
            let retryCount = 0;
            let result = null;

            while (retryCount <= config.maxQueryRetries) {
              try {
                // Execute the query
                const parameters = question.parameters || {};
                result = await executeQueryPattern(
                  question.queryPattern,
                  parameters,
                  config.maxTimeMS + (retryCount * 5000) // Increase timeout with each retry
                );

                // If successful, break the retry loop
                if (result.success) {
                  break;
                }

                // If not a timeout error, no need to retry
                if (!result.error || !result.error.includes('time limit')) {
                  break;
                }

                // Retry with a more optimized query
                console.log(`Query timed out, retrying (${retryCount + 1}/${config.maxQueryRetries})...`);
                retryCount++;
              } catch (error) {
                console.error(`Error executing query for question "${question.text}":`, error);
                result = {
                  success: false,
                  error: error.message
                };
                break;
              }
            }

            if (result.success) {
              console.log(`Query returned ${result.count} results in ${result.executionTime}ms`);
              successfulQueries++;

              if (result.optimized) {
                optimizedQueries++;
              }

              if (result.fallback) {
                console.log(`Used fallback strategy due to: ${result.originalError}`);
              }

              // Validate results
              const validation = validateResults(result.results, {
                requiredFields: ['_id'] // Basic validation
              });

              question.execution = {
                success: true,
                resultCount: result.count,
                sampleResults: result.results.slice(0, config.sampleSize),
                validation,
                executionTime: result.executionTime,
                optimized: result.optimized,
                fallback: result.fallback,
                originalError: result.originalError
              };
            } else {
              console.log(`Query failed: ${result.error}`);
              failedQueries++;

              // Check if this was a timeout
              if (result.error && result.error.includes('time limit')) {
                timeoutQueries++;
              }

              question.execution = {
                success: false,
                error: result.error
              };
            }
          }

          validatedQuestions.push(question);
        }
      }
    } else {
      // Skip validation
      validatedQuestions.push(...questions);
    }

    // Step 6: Save the results
    console.log('Step 6: Saving results...');
    const outputDir = config.outputDir;

    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      console.log('Output directory already exists');
    }

    await fs.writeFile(
      path.join(outputDir, 'schema-info.json'),
      JSON.stringify(schemaInfo, null, 2)
    );

    await fs.writeFile(
      path.join(outputDir, 'relationships.json'),
      JSON.stringify(relationships, null, 2)
    );

    await fs.writeFile(
      path.join(outputDir, 'query-patterns.json'),
      JSON.stringify(queryPatterns, null, 2)
    );

    await fs.writeFile(
      path.join(outputDir, 'validated-questions.json'),
      JSON.stringify(validatedQuestions, null, 2)
    );

    // Generate a summary report
    const summary = {
      collections: Object.keys(schemaInfo).length,
      relationships: relationships.length,
      queryPatterns: queryPatterns.length,
      questions: questions.length,
      successfulQueries,
      failedQueries,
      timeoutQueries,
      optimizedQueries,
      validationEnabled: config.validateQueries,
      timestamp: new Date().toISOString(),
      config: {
        sampleSize: config.sampleSize,
        maxTimeMS: config.maxTimeMS,
        skipLargeCollections: config.skipLargeCollections,
        maxQueryRetries: config.maxQueryRetries
      }
    };

    await fs.writeFile(
      path.join(outputDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('Self-learning process completed successfully!');
    console.log(`Results saved to ${outputDir}`);

    // Return the results
    return {
      schemaInfo,
      relationships,
      queryPatterns,
      validatedQuestions,
      summary
    };
  } catch (error) {
    console.error('Error in self-learning process:', error);
    throw error;
  } finally {
    // Don't close the connection if it was already open
    if (options.closeConnection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
  }
}

/**
 * Runs the self-learning process as a standalone script
 */
async function runAsScript() {
  try {
    await runSelfLearning({ closeConnection: true });
    process.exit(0);
  } catch (error) {
    console.error('Error running self-learning script:', error);
    process.exit(1);
  }
}

// Run as script if called directly
if (require.main === module) {
  runAsScript();
}

module.exports = { runSelfLearning };
