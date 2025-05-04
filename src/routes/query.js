const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const queryBuilder = require('../utils/queryBuilder');
const deepseekService = require('../services/deepseekService');
const selfLearningService = require('../services/selfLearningService');

router.post('/', async (req, res, next) => {
    try {
        const { query, collection = 'documents', conversationId } = req.body;

        if (!query) {
            return res.status(400).json({
                message: 'Query is required'
            });
        }

        // Initialize self-learning service if not already initialized
        if (!selfLearningService.initialized) {
            try {
                await selfLearningService.initialize();
                console.log('Self-learning service initialized');
            } catch (error) {
                console.error('Error initializing self-learning service:', error);
                console.log('Continuing without self-learning service');
            }
        }

        // Try to get a query pattern from self-learning
        let selfLearningQuery = null;
        if (selfLearningService.initialized) {
            console.log('Checking self-learning for similar query...');
            const patternInfo = selfLearningService.getQueryPatternForQuery(query, { threshold: 0.7 });

            if (patternInfo && patternInfo.pattern && patternInfo.pattern.mongoQuery) {
                console.log('Found similar query in self-learning:', patternInfo.matchedQuestion.text);
                console.log('Similarity score:', patternInfo.confidence);

                selfLearningQuery = {
                    mongoQuery: patternInfo.pattern.mongoQuery,
                    matchedQuestion: patternInfo.matchedQuestion.text,
                    confidence: patternInfo.confidence,
                    explanation: `Query generated based on pattern: ${patternInfo.pattern.description}`
                };

                console.log('Self-learning query:', JSON.stringify(selfLearningQuery));
            } else {
                console.log('No similar query found in self-learning');
            }
        }

        // Get schema information from self-learning
        let schemaInfo = null;
        if (selfLearningService.initialized) {
            schemaInfo = selfLearningService.getCollectionSchema(collection);

            // Get relationships for this collection
            const relationships = selfLearningService.getCollectionRelationships(collection);
            if (relationships && relationships.length > 0) {
                schemaInfo = schemaInfo || {};
                schemaInfo.relationships = relationships;
            }
        }

        // Process the query through DeepSeek
        const deepseekResponse = await deepseekService.processQuery(
            query,
            collection,
            schemaInfo || conversationId,
            conversationId
        );

        // If there was an error with DeepSeek, try self-learning query or fall back to direct query processing
        if (deepseekResponse.error) {
            console.warn('DeepSeek error:', deepseekResponse.error);

            // Try self-learning query if available
            if (selfLearningQuery) {
                console.log('Using self-learning query as fallback');

                // Get the specified collection
                const db = mongoose.connection.db;
                const mongoCollection = db.collection(collection);

                // Execute the query
                let pipeline = selfLearningQuery.mongoQuery.pipeline || selfLearningQuery.mongoQuery.query;
                if (!Array.isArray(pipeline)) {
                    pipeline = [{ $match: pipeline }];
                }

                const results = await mongoCollection.aggregate(pipeline).toArray();

                return res.json({
                    query: query,
                    timestamp: new Date(),
                    results: results,
                    pipeline: pipeline,
                    selfLearning: true,
                    matchedQuestion: selfLearningQuery.matchedQuestion,
                    confidence: selfLearningQuery.confidence,
                    explanation: selfLearningQuery.explanation
                });
            }

            console.warn('Falling back to direct query processing');

            // Get the specified collection
            const db = mongoose.connection.db;
            const mongoCollection = db.collection(collection);

            // Build the aggregation pipeline
            const pipeline = queryBuilder.buildAggregationPipeline(query, collection);

            // Execute the aggregation
            const results = await mongoCollection.aggregate(pipeline).toArray();

            return res.json({
                query: query,
                timestamp: new Date(),
                results: results,
                pipeline: pipeline,
                fallback: true
            });
        }

        // Get the specified collection for executing the processed query
        const db = mongoose.connection.db;
        const mongoCollection = db.collection(collection);

        // Execute the query
        const pipeline = queryBuilder.buildAggregationPipeline(deepseekResponse.content, collection);
        const results = await mongoCollection.aggregate(pipeline).toArray();

        const response = {
            query: query,
            processedQuery: deepseekResponse.content,
            timestamp: new Date(),
            results: results,
            pipeline: pipeline,
            queryType: deepseekResponse.queryType,
            tokenUsage: deepseekResponse.tokenUsage,
            conversationId: deepseekResponse.conversationId
        };

        // Add self-learning information if available
        if (selfLearningQuery) {
            response.selfLearningMatch = {
                matchedQuestion: selfLearningQuery.matchedQuestion,
                confidence: selfLearningQuery.confidence,
                explanation: selfLearningQuery.explanation
            };
        }

        res.json(response);
    } catch (error) {
        console.error('Query execution error:', error);
        next(error);
    }
});

// Direct query for player percentage
router.post('/direct/player-percentage', async (req, res) => {
    try {
        const { threshold = 3 } = req.body;

        // Get the events collection
        const db = mongoose.connection.db;
        const eventsCollection = db.collection('events');

        // Build the pipeline
        const pipeline = [
            // Group events by player to count how many times each player played
            {
                $group: {
                    _id: "$playerId",
                    playCount: { $sum: 1 }
                }
            },

            // Add a field to identify players who played more than threshold times
            {
                $addFields: {
                    playedMoreThanThreshold: { $gt: ["$playCount", threshold] }
                }
            },

            // Group all results to calculate percentages
            {
                $group: {
                    _id: null,
                    totalPlayers: { $sum: 1 },
                    playersMoreThanThreshold: {
                        $sum: { $cond: [{ $eq: ["$playedMoreThanThreshold", true] }, 1, 0] }
                    }
                }
            },

            // Calculate the percentage
            {
                $project: {
                    _id: 0,
                    totalPlayers: 1,
                    playersMoreThanThreshold: 1,
                    percentage: {
                        $multiply: [
                            { $divide: ["$playersMoreThanThreshold", "$totalPlayers"] },
                            100
                        ]
                    }
                }
            }
        ];

        // Execute the query
        const results = await eventsCollection.aggregate(pipeline).toArray();

        res.json({
            query: `What is the percentage of players who played more than ${threshold} times?`,
            timestamp: new Date(),
            results: results,
            pipeline: pipeline,
            directQuery: true
        });
    } catch (error) {
        console.error('Direct query execution error:', error);
        res.status(500).json({
            error: 'Error executing direct query',
            message: error.message
        });
    }
});

// Get token usage statistics
router.get('/usage', async (req, res) => {
    const usage = deepseekService.getTokenUsage();
    res.json(usage);
});

// Get self-learning status
router.get('/self-learning/status', async (req, res) => {
    try {
        if (!selfLearningService.initialized) {
            await selfLearningService.initialize();
        }

        const summary = selfLearningService.getSummary();
        const status = {
            initialized: selfLearningService.initialized,
            lastRunTimestamp: selfLearningService.lastRunTimestamp,
            summary
        };

        res.json(status);
    } catch (error) {
        console.error('Error getting self-learning status:', error);
        res.status(500).json({
            error: 'Error getting self-learning status',
            message: error.message
        });
    }
});

// Get self-learning relationships
router.get('/self-learning/relationships', async (req, res) => {
    try {
        if (!selfLearningService.initialized) {
            await selfLearningService.initialize();
        }

        const relationships = selfLearningService.getAllRelationships();
        res.json(relationships);
    } catch (error) {
        console.error('Error getting relationships:', error);
        res.status(500).json({
            error: 'Error getting relationships',
            message: error.message
        });
    }
});

// Get self-learning query patterns
router.get('/self-learning/patterns', async (req, res) => {
    try {
        if (!selfLearningService.initialized) {
            await selfLearningService.initialize();
        }

        const patterns = selfLearningService.getAllQueryPatterns();
        res.json(patterns);
    } catch (error) {
        console.error('Error getting query patterns:', error);
        res.status(500).json({
            error: 'Error getting query patterns',
            message: error.message
        });
    }
});

// Get self-learning questions
router.get('/self-learning/questions', async (req, res) => {
    try {
        if (!selfLearningService.initialized) {
            await selfLearningService.initialize();
        }

        const { limit = 20, successful, collection } = req.query;

        let questions = selfLearningService.getAllQuestions();

        // Filter by success status if specified
        if (successful !== undefined) {
            const isSuccessful = successful === 'true';
            questions = questions.filter(q =>
                q.execution && q.execution.success === isSuccessful
            );
        }

        // Filter by collection if specified
        if (collection) {
            questions = questions.filter(q =>
                q.collections && q.collections.includes(collection)
            );
        }

        // Sort by execution time (if available)
        questions.sort((a, b) => {
            if (a.execution && b.execution &&
                a.execution.executionTime !== undefined &&
                b.execution.executionTime !== undefined) {
                return a.execution.executionTime - b.execution.executionTime;
            }
            return 0;
        });

        // Limit the number of questions
        questions = questions.slice(0, parseInt(limit));

        res.json(questions);
    } catch (error) {
        console.error('Error getting questions:', error);
        res.status(500).json({
            error: 'Error getting questions',
            message: error.message
        });
    }
});

// Run self-learning process
router.post('/self-learning/run', async (req, res) => {
    try {
        const options = req.body || {};

        // Start the self-learning process in the background
        res.json({
            message: 'Self-learning process started',
            timestamp: new Date(),
            options
        });

        // Run the self-learning process after sending the response
        await selfLearningService.runSelfLearning(options);

        console.log('Self-learning process completed');
    } catch (error) {
        console.error('Error running self-learning process:', error);
        // Error is logged but not returned to the client since the response has already been sent
    }
});

// Run self-learning process with safe options (skipping large collections)
router.post('/self-learning/run-safe', async (req, res) => {
    try {
        // Use safe options that won't time out
        const safeOptions = {
            skipLargeCollections: true,
            maxTimeMS: 5000,
            validateQueries: true,
            sampleSize: 5,
            maxQueryRetries: 1,
            ...req.body
        };

        // Start the self-learning process in the background
        res.json({
            message: 'Self-learning process started with safe options',
            timestamp: new Date(),
            options: safeOptions
        });

        // Run the self-learning process after sending the response
        await selfLearningService.runSelfLearning(safeOptions);

        console.log('Self-learning process completed');
    } catch (error) {
        console.error('Error running self-learning process:', error);
        // Error is logged but not returned to the client since the response has already been sent
    }
});

// Relationship query route
router.post('/relationship', async (req, res, next) => {
    try {
        const { query, primaryCollection, relatedCollection, schemaInfo, forcePipeline } = req.body;

        if (!query || !primaryCollection || !relatedCollection) {
            return res.status(400).json({
                message: 'Query, primaryCollection, and relatedCollection are required'
            });
        }

        console.log('Processing relationship query:', query);
        console.log('Primary Collection:', primaryCollection);
        console.log('Related Collection:', relatedCollection);

        // Initialize self-learning service if not already initialized
        if (!selfLearningService.initialized) {
            try {
                await selfLearningService.initialize();
                console.log('Self-learning service initialized');
            } catch (error) {
                console.error('Error initializing self-learning service:', error);
                console.log('Continuing without self-learning service');
            }
        }

        // If forcePipeline is provided, use it directly
        let pipeline = forcePipeline || null;
        let explanation = '';
        let selfLearningUsed = false;

        // Try to get a relationship query from self-learning
        if (!pipeline && selfLearningService.initialized) {
            console.log('Checking self-learning for relationship query...');

            // Get relationship information
            const relationship = selfLearningService.getRelationship(primaryCollection, relatedCollection);
            if (relationship) {
                console.log('Found relationship in self-learning:', relationship.description);

                // Get query patterns for this relationship
                const queryPatterns = selfLearningService.getCollectionQueryPatterns(primaryCollection)
                    .filter(pattern =>
                        pattern.collections &&
                        pattern.collections.includes(primaryCollection) &&
                        pattern.collections.includes(relatedCollection)
                    );

                if (queryPatterns.length > 0) {
                    console.log(`Found ${queryPatterns.length} query patterns for this relationship`);

                    // Find the most relevant query pattern
                    const patternInfo = selfLearningService.getQueryPatternForQuery(query, { threshold: 0.6 });

                    if (patternInfo && patternInfo.pattern && patternInfo.pattern.mongoQuery) {
                        console.log('Found similar query in self-learning:', patternInfo.matchedQuestion.text);
                        console.log('Similarity score:', patternInfo.confidence);

                        pipeline = patternInfo.pattern.mongoQuery.pipeline;
                        explanation = `MongoDB aggregation pipeline generated by Self-Learning System based on similar query: "${patternInfo.matchedQuestion.text}" (confidence: ${Math.round(patternInfo.confidence * 100)}%)`;
                        selfLearningUsed = true;
                    } else {
                        // Use the first query pattern as a fallback
                        const bestPattern = queryPatterns.find(p => p.id === 'avg_attempts_per_question') ||
                                           queryPatterns.find(p => p.complexity === 'advanced') ||
                                           queryPatterns[0];

                        console.log('Using query pattern as fallback:', bestPattern.id);
                        pipeline = bestPattern.mongoQuery.pipeline;
                        explanation = `MongoDB aggregation pipeline generated by Self-Learning System based on pattern: "${bestPattern.description}"`;
                        selfLearningUsed = true;
                    }
                }
            }
        }

        // Get enhanced schema information from self-learning
        let enhancedSchemaInfo = schemaInfo || {};
        if (selfLearningService.initialized) {
            // Get schema information for both collections
            const primarySchema = selfLearningService.getCollectionSchema(primaryCollection);
            const relatedSchema = selfLearningService.getCollectionSchema(relatedCollection);

            if (primarySchema || relatedSchema) {
                enhancedSchemaInfo = {
                    ...enhancedSchemaInfo,
                    primaryCollection: primarySchema,
                    relatedCollection: relatedSchema
                };

                // Get relationship information
                const relationship = selfLearningService.getRelationship(primaryCollection, relatedCollection);
                if (relationship) {
                    enhancedSchemaInfo.relationship = relationship;
                }
            }
        }

        // If no pipeline from self-learning, process through DeepSeek
        if (!pipeline) {
            try {
                const deepseekResponse = await deepseekService.processQuery(
                    query, primaryCollection, enhancedSchemaInfo
                );
                console.log('Deepseek Response:', deepseekResponse);

                if (deepseekResponse && deepseekResponse.content) {
                    try {
                        // Try to parse the content as a MongoDB query
                        pipeline = JSON.parse(deepseekResponse.content);
                        explanation = `MongoDB aggregation pipeline generated by Deepseek LLM based on natural language query: "${query}"`;
                    } catch (parseError) {
                        console.error('Error parsing Deepseek response:', parseError);
                        // Will use fallback pipeline below
                    }
                }
            } catch (deepseekError) {
                console.error('Error calling Deepseek service:', deepseekError);
                // Will use fallback pipeline below
            }
        } else if (!selfLearningUsed) {
            explanation = 'Using provided pipeline for relationship query';
            console.log('Using forced pipeline:', JSON.stringify(pipeline));
        }

        // If no valid pipeline was generated, use a fallback
        if (!pipeline || !Array.isArray(pipeline)) {
            console.log('Using fallback pipeline for relationship query');

            // Special case for events-questions relationship
            if ((primaryCollection === 'events' && relatedCollection === 'questions') ||
                (primaryCollection === 'questions' && relatedCollection === 'events')) {

                // Determine which collection to start with
                const startCollection = primaryCollection === 'events' ? 'events' : 'questions';

                if (startCollection === 'events') {
                    // Start with events collection - FIXED PIPELINE
                    pipeline = [
                        { $match: { type: 'question' } },
                        { $lookup: {
                            from: 'questions',
                            localField: 'context.questionId',
                            foreignField: '_id',
                            as: 'related'
                          }
                        },
                        // Skip the $unwind stage since it fails when there are no matches
                        { $project: {
                            event_id: '$_id',
                            player_id: '$playerId',
                            question_id: '$context.questionId',
                            correct: '$correct',
                            timeTaken: '$timeTaken',
                            type: '$type',
                            // Include related question data if available, otherwise null
                            question_text: { $cond: { if: { $gt: [{ $size: '$related' }, 0] }, then: { $arrayElemAt: ['$related.text', 0] }, else: null } }
                          }
                        }
                    ];

                    // If the query is about average attempts
                    if (query.toLowerCase().includes('average') &&
                        (query.toLowerCase().includes('answer') || query.toLowerCase().includes('attempt'))) {
                        pipeline = [
                            { $match: { type: 'question' } },
                            { $group: {
                                _id: {
                                    playerId: '$playerId',
                                    questionId: '$context.questionId'
                                },
                                count: { $sum: 1 }
                              }
                            },
                            { $group: {
                                _id: '$_id.questionId',
                                avgAttempts: { $avg: '$count' }
                              }
                            },
                            { $project: {
                                questionId: '$_id',
                                avgAttempts: 1,
                                // Convert questionId to lowercase for case-insensitive matching
                                questionIdLower: { $toLower: '$_id' },
                                _id: 0
                              }
                            },
                            // Use $lookup with $expr to do case-insensitive matching
                            { $lookup: {
                                from: 'questions',
                                let: { qid: '$questionIdLower' },
                                pipeline: [
                                  { $addFields: { idLower: { $toLower: { $toString: '$_id' } } } },
                                  { $match: { $expr: { $eq: ['$idLower', '$$qid'] } } }
                                ],
                                as: 'questionDetails'
                              }
                            },
                            // Add question text and additional information to the output
                            { $project: {
                                questionId: 1,
                                avgAttempts: 1,
                                // Use $ifNull to handle cases where question details might not be found
                                questionText: {
                                  $ifNull: [
                                    { $arrayElemAt: ['$questionDetails.text', 0] },
                                    'Question text not available'
                                  ]
                                },
                                // Add a message explaining the situation
                                message: {
                                  $cond: {
                                    if: { $eq: [{ $size: '$questionDetails' }, 0] },
                                    then: 'No matching question found. This may be due to the ID format difference.',
                                    else: ''
                                  }
                                },
                                // Include the number of attempts for this question
                                totalAttempts: { $round: ['$avgAttempts', 0] }
                              }
                            },
                            { $sort: { avgAttempts: -1 } }
                        ];
                        explanation = 'Calculating average number of attempts per question';
                    } else {
                        explanation = 'Finding events with type "question" and their related question details';
                    }
                } else {
                    // Start with questions collection
                    pipeline = [
                        { $match: {} },
                        { $lookup: {
                            from: 'events',
                            localField: '_id',
                            foreignField: 'context.questionId',
                            as: 'events'
                          }
                        },
                        { $project: {
                            question_id: '$_id',
                            question_text: '$text',
                            event_count: { $size: '$events' }
                          }
                        }
                    ];
                    explanation = 'Finding questions and their related events';
                }
            } else {
                // Default fallback for other relationships
                pipeline = [
                    { $match: {} },
                    { $limit: 20 }
                ];
                explanation = `Fallback query for ${primaryCollection}-${relatedCollection} relationship`;
            }
        }

        // Get the specified collection
        const db = mongoose.connection.db;
        const mongoCollection = db.collection(primaryCollection);

        // Execute the aggregation pipeline
        const results = await mongoCollection.aggregate(pipeline).toArray();

        // Log what we're sending to the client
        console.log(`Sending response to client with ${results.length} results`);

        const response = {
            query,
            timestamp: new Date(),
            results,
            processedQuery: `db.${primaryCollection}.aggregate(${JSON.stringify(pipeline)})`,
            pipeline: pipeline,
            explanation: explanation
        };

        // Add self-learning information if used
        if (selfLearningUsed) {
            response.selfLearningUsed = true;
        }

        res.json(response);
    } catch (error) {
        console.error('Relationship query execution error:', error);
        next(error);
    }
});

module.exports = router;