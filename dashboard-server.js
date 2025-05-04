require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
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

// Simple authentication middleware that always passes
const authMiddleware = (req, res, next) => {
  console.log('Auth middleware: bypassing authentication');
  next();
};

// Helper function to safely read a JSON file
async function safeReadJsonFile(filePath) {
  try {
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      console.warn(`File does not exist: ${filePath}`);
      return null;
    }
    
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

// Helper function to ensure directory exists
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    // Directory doesn't exist, create it
    console.log(`Creating directory: ${dirPath}`);
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Login route
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Simple authentication for testing
  if (username === 'test' && password === 'test') {
    const token = jwt.sign(
      { userId: 'test-user-id', username: 'test' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    return res.json({ token });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});

// Dashboard data route
app.get('/api/dashboard/data', async (req, res) => {
  try {
    console.log('Dashboard data endpoint called');
    
    // Default data
    const defaultData = {
      summary: {
        totalCollections: 5,
        totalRelationships: 3,
        totalQueryPatterns: 10,
        totalQuestions: 20,
        successfulQueries: 15,
        failedQueries: 3,
        timeoutQueries: 2,
        optimizedQueries: 8,
        lastRunTimestamp: new Date(),
        collections: 5,
        relationships: 3,
        queryPatterns: 10,
        questions: 20,
        lastUpdated: new Date()
      },
      relationships: [
        {
          source: { collection: 'players', field: '_id' },
          target: { collection: 'events', field: 'playerId' },
          description: 'Players to Events relationship',
          confidence: 0.95
        },
        {
          source: { collection: 'events', field: 'context.questionId' },
          target: { collection: 'questions', field: '_id' },
          description: 'Events to Questions relationship',
          confidence: 0.9
        },
        {
          source: { collection: 'events', field: 'context.zoneId' },
          target: { collection: 'zones', field: '_id' },
          description: 'Events to Zones relationship',
          confidence: 0.85
        }
      ],
      queryPatterns: [
        {
          id: 'avg_attempts_per_question',
          description: 'Average attempts per question',
          collections: ['events', 'questions'],
          complexity: 'advanced',
          category: 'performance',
          mongoQuery: {
            pipeline: [
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
              }
            ]
          }
        },
        {
          id: 'player_activity',
          description: 'Player activity over time',
          collections: ['players', 'events'],
          complexity: 'medium',
          category: 'engagement',
          mongoQuery: {
            pipeline: [
              { $match: { type: 'signin' } },
              { $group: {
                  _id: {
                    playerId: '$playerId',
                    day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                  },
                  count: { $sum: 1 }
                }
              }
            ]
          }
        },
        {
          id: 'average_play_time',
          description: 'Average play time for players based on signin/signout events',
          collections: ['events'],
          complexity: 'advanced',
          category: 'engagement',
          mongoQuery: {
            pipeline: [
              { $match: { type: { $in: ['signin', 'signout'] } } },
              { $sort: { playerId: 1, time: 1 } },
              { $group: {
                  _id: '$playerId',
                  events: { 
                    $push: { 
                      type: '$type', 
                      time: '$time' 
                    } 
                  }
                }
              }
            ]
          }
        }
      ],
      questions: [
        {
          id: 'q1',
          text: 'What is the average number of attempts per question?',
          collections: ['events', 'questions'],
          intent: 'analysis',
          category: 'performance',
          queryPattern: 'avg_attempts_per_question',
          execution: {
            success: true,
            executionTime: 120,
            resultCount: 15
          }
        },
        {
          id: 'q2',
          text: 'How many players signed in each day?',
          collections: ['players', 'events'],
          intent: 'analysis',
          category: 'engagement',
          queryPattern: 'player_activity',
          execution: {
            success: true,
            executionTime: 85,
            resultCount: 30
          }
        },
        {
          id: 'q3',
          text: 'What is the average play time of players?',
          collections: ['events'],
          intent: 'analysis',
          category: 'engagement',
          queryPattern: 'average_play_time',
          execution: {
            success: true,
            executionTime: 150,
            resultCount: 1
          }
        }
      ],
      stats: {
        successfulQueries: 15,
        failedQueries: 3,
        averageExecutionTime: 102.5
      }
    };

    // Try to load data from files
    try {
      const dataDir = path.join(__dirname, 'data', 'self-learning');
      
      // Ensure the data directory exists
      await ensureDirectoryExists(dataDir);
      
      // Load summary
      const summaryPath = path.join(dataDir, 'summary.json');
      const summaryData = await safeReadJsonFile(summaryPath);
      if (summaryData) {
        defaultData.summary = { ...summaryData, lastUpdated: new Date() };
      }
      
      // Load relationships
      const relationshipsPath = path.join(dataDir, 'relationships.json');
      const relationshipsData = await safeReadJsonFile(relationshipsPath);
      if (relationshipsData) {
        defaultData.relationships = relationshipsData;
      }
      
      // Load query patterns
      const queryPatternsPath = path.join(dataDir, 'query-patterns.json');
      const queryPatternsData = await safeReadJsonFile(queryPatternsPath);
      if (queryPatternsData) {
        defaultData.queryPatterns = queryPatternsData;
      }
      
      // Load questions
      const questionsPath = path.join(dataDir, 'validated-questions.json');
      const questionsData = await safeReadJsonFile(questionsPath);
      if (questionsData) {
        defaultData.questions = questionsData;
      }
      
      console.log('Loaded data from files');
    } catch (error) {
      console.warn('Error loading data from files:', error);
      console.log('Using default data');
    }

    // Get real collection information from MongoDB
    try {
      if (mongoose.connection.readyState === 1) { // Connected
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        // Update collection count in summary
        defaultData.summary.totalCollections = collections.length;
        defaultData.summary.collections = collections.length;
        
        console.log(`Updated collection count from MongoDB: ${collections.length}`);
      }
    } catch (mongoError) {
      console.warn('Error getting MongoDB collections:', mongoError);
    }

    res.json(defaultData);
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      error: 'Error getting dashboard data',
      message: error.message
    });
  }
});

// Load collection summaries
async function loadCollectionSummaries() {
  try {
    const summaryPath = path.join(__dirname, 'data', 'collection-summaries', 'combined-summary.json');
    const data = await fs.readFile(summaryPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading collection summaries:', error);
    return null;
  }
}

// Query route
app.post('/api/query', authMiddleware, async (req, res) => {
  try {
    const { query, collection = 'events' } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);

    // Load collection summaries
    const collectionSummaries = await loadCollectionSummaries();
    console.log('Collection summaries loaded:', !!collectionSummaries);

    // Generate a pipeline based on the query
    let pipeline;
    let explanation;
    let options = {};

    // Special case for average play time query
    if (query.toLowerCase().includes('average play time') || 
        query.toLowerCase().includes('average playtime')) {
      console.log('Detected average play time query');
      
      if (collection === 'events') {
        // Use a multi-step approach to avoid memory issues
        
        // Step 1: Get a sample of players
        console.log('Step 1: Getting a sample of players with signin/signout events');
        const playerSamplePipeline = [
          { $match: { type: { $in: ['signin', 'signout'] } } },
          { $group: { _id: '$playerId' } },
          { $sample: { size: 100 } } // Sample 100 players
        ];
        
        const playerSample = await mongoose.connection.db.collection('events')
          .aggregate(playerSamplePipeline, { allowDiskUse: true })
          .toArray();
        
        console.log(`Found ${playerSample.length} players with signin/signout events`);
        
        // Step 2: Process each player individually
        console.log('Step 2: Processing each player individually');
        const playerResults = [];
        
        for (const player of playerSample) {
          const playerId = player._id;
          
          // Get all signin/signout events for this player
          const playerEventsPipeline = [
            { $match: { 
                playerId: playerId,
                type: { $in: ['signin', 'signout'] } 
              } 
            },
            { $sort: { time: 1 } },
            { $project: { 
                _id: 0,
                type: 1,
                time: 1
              } 
            }
          ];
          
          const playerEvents = await mongoose.connection.db.collection('events')
            .aggregate(playerEventsPipeline, { allowDiskUse: true })
            .toArray();
          
          // Calculate session times manually
          const sessionTimes = [];
          for (let i = 0; i < playerEvents.length - 1; i++) {
            if (playerEvents[i].type === 'signin' && playerEvents[i+1].type === 'signout') {
              const sessionTime = new Date(playerEvents[i+1].time) - new Date(playerEvents[i].time);
              if (sessionTime > 0) {
                sessionTimes.push(sessionTime);
              }
            }
          }
          
          // Calculate average session time
          if (sessionTimes.length > 0) {
            const totalTime = sessionTimes.reduce((sum, time) => sum + time, 0);
            const avgTime = totalTime / sessionTimes.length;
            
            playerResults.push({
              playerId: playerId,
              sessionCount: sessionTimes.length,
              averageSessionTime: avgTime
            });
          }
        }
        
        console.log(`Processed ${playerResults.length} players with valid sessions`);
        
        // Step 3: Calculate overall statistics
        if (playerResults.length > 0) {
          const totalPlayers = playerResults.length;
          const allSessionTimes = playerResults.map(p => p.averageSessionTime);
          const averagePlayTime = allSessionTimes.reduce((sum, time) => sum + time, 0) / totalPlayers;
          const minPlayTime = Math.min(...allSessionTimes);
          const maxPlayTime = Math.max(...allSessionTimes);
          
          // Convert to seconds and round
          const result = {
            averagePlayTime: Math.round((averagePlayTime / 1000) * 100) / 100,
            totalPlayers: totalPlayers,
            minPlayTime: Math.round((minPlayTime / 1000) * 100) / 100,
            maxPlayTime: Math.round((maxPlayTime / 1000) * 100) / 100,
            unit: 'seconds',
            playerSamples: playerResults.slice(0, 5).map(p => ({
              playerId: p.playerId,
              sessions: p.sessionCount,
              avgSessionTime: Math.round((p.averageSessionTime / 1000) * 100) / 100
            })),
            note: 'Results based on sampled data for performance reasons'
          };
          
          console.log('Final result:', result);
          
          // Return the result
          return res.json({
            query,
            timestamp: new Date(),
            results: [result],
            processedQuery: 'Custom multi-step processing for average play time calculation',
            explanation: 'Custom calculation of average play time based on signin/signout events'
          });
        } else {
          return res.json({
            query,
            timestamp: new Date(),
            results: [{
              message: "No valid sessions found. This could be because there are no players with both signin and signout events.",
              collection: collection,
              databaseName: mongoose.connection.db.databaseName,
              query: query
            }],
            processedQuery: 'Custom multi-step processing for average play time calculation',
            explanation: 'Custom calculation of average play time based on signin/signout events'
          });
        }
      } else {
        pipeline = [
          { $match: {} },
          { $limit: 20 }
        ];
        explanation = 'Default pipeline for non-events collection';
      }
    } else {
      // Default fallback pipeline
      pipeline = [
        { $match: {} },
        { $limit: 20 }
      ];
      explanation = 'Default fallback pipeline';
    }

    // Only execute the pipeline if we haven't already returned a response
    if (pipeline) {
      // Get the database connection
      const db = mongoose.connection.db;
      const mongoCollection = db.collection(collection);

      // Execute the query
      console.log('Executing pipeline:', JSON.stringify(pipeline));
      console.log('Query options:', JSON.stringify(options));
      const results = await mongoCollection.aggregate(pipeline, options).toArray();
      console.log(`Query returned ${results.length} results`);

      // If no results were found, provide a meaningful message
      if (results.length === 0) {
        results.push({
          message: "No results found. This could be because there are no documents in the collection or no documents match the query criteria.",
          collection: collection,
          databaseName: mongoose.connection.db.databaseName,
          query: query
        });
      }

      // Return response with all the fields needed for debug info
      res.json({
        query,
        timestamp: new Date(),
        results,
        processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)}, ${JSON.stringify(options)})`,
        pipeline: pipeline,
        explanation: explanation
      });
    }
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({ message: 'Query execution failed', error: error.message });
  }
});

// Connect to MongoDB
console.log('Connecting to MongoDB...');
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'mmldb';

console.log('MongoDB URI:', mongoUri ? `${mongoUri.substring(0, 20)}...` : 'Not found');
console.log('MongoDB Database Name:', dbName);

mongoose.connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB database:', mongoose.connection.db.databaseName);
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
