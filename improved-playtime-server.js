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
        // Try a different approach for calculating play time
        // First, let's count how many signin/signout events we have
        const eventCount = await mongoose.connection.db.collection('events')
          .countDocuments({ type: { $in: ['signin', 'signout'] } });
        
        console.log(`Total signin/signout events: ${eventCount}`);
        
        // Determine an appropriate sample size based on the total count
        // Use at most 100,000 events or 20% of the total, whichever is smaller
        const sampleSize = Math.min(100000, Math.ceil(eventCount * 0.2));
        console.log(`Using sample size: ${sampleSize}`);
        
        pipeline = [
          // Match only signin and signout events
          { $match: { type: { $in: ['signin', 'signout'] } } },
          
          // Sample a subset of events to avoid memory issues
          { $sample: { size: sampleSize } },
          
          // Sort by player ID and time to ensure events are in chronological order
          { $sort: { playerId: 1, time: 1 } },
          
          // Group by player ID to get all signin/signout events for each player
          { $group: {
              _id: '$playerId',
              events: { 
                $push: { 
                  type: '$type', 
                  time: '$time' 
                } 
              }
            }
          },
          
          // Calculate play time for each player
          { $addFields: {
              sessionTimes: {
                $reduce: {
                  input: { $range: [0, { $subtract: [{ $size: '$events' }, 1] }] },
                  initialValue: [],
                  in: {
                    $concatArrays: [
                      '$$value',
                      {
                        $cond: {
                          if: {
                            $and: [
                              { $eq: [{ $arrayElemAt: ['$events.type', '$$this'] }, 'signin'] },
                              { $eq: [{ $arrayElemAt: ['$events.type', { $add: ['$$this', 1] }] }, 'signout'] }
                            ]
                          },
                          then: [{
                            $subtract: [
                              { $arrayElemAt: ['$events.time', { $add: ['$$this', 1] }] },
                              { $arrayElemAt: ['$events.time', '$$this'] }
                            ]
                          }],
                          else: []
                        }
                      }
                    ]
                  }
                }
              }
            }
          },
          
          // Calculate average play time for each player
          { $addFields: {
              totalPlayTime: { $sum: '$sessionTimes' },
              sessionCount: { $size: '$sessionTimes' },
              averageSessionTime: { 
                $cond: {
                  if: { $gt: [{ $size: '$sessionTimes' }, 0] },
                  then: { $divide: [{ $sum: '$sessionTimes' }, { $size: '$sessionTimes' }] },
                  else: 0
                }
              }
            }
          },
          
          // Filter out players with no valid sessions
          { $match: { sessionCount: { $gt: 0 } } },
          
          // Calculate overall average play time across all players
          { $group: {
              _id: null,
              averagePlayTime: { $avg: '$averageSessionTime' },
              totalPlayers: { $sum: 1 },
              minPlayTime: { $min: '$averageSessionTime' },
              maxPlayTime: { $max: '$averageSessionTime' },
              playerSamples: { $push: { id: '$_id', sessions: '$sessionCount', avgTime: '$averageSessionTime' } }
            }
          },
          
          // Add sample player data and limit to 5 examples
          { $addFields: {
              playerSamples: { $slice: ['$playerSamples', 5] }
            }
          },
          
          // Convert milliseconds to seconds and format the output
          { $project: {
              _id: 0,
              averagePlayTime: { $round: [{ $divide: ['$averagePlayTime', 1000] }, 2] },
              totalPlayers: 1,
              minPlayTime: { $round: [{ $divide: ['$minPlayTime', 1000] }, 2] },
              maxPlayTime: { $round: [{ $divide: ['$maxPlayTime', 1000] }, 2] },
              unit: { $literal: 'seconds' },
              playerSamples: {
                $map: {
                  input: '$playerSamples',
                  as: 'player',
                  in: {
                    playerId: '$$player.id',
                    sessions: '$$player.sessions',
                    avgSessionTime: { $round: [{ $divide: ['$$player.avgTime', 1000] }, 2] }
                  }
                }
              },
              note: { $literal: 'Results based on sampled data for performance reasons' }
            }
          }
        ];
        explanation = 'MongoDB aggregation pipeline for calculating average play time across all players based on signin/signout events (sampled data)';
        
        // Enable disk use for large datasets
        options = { allowDiskUse: true };
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
