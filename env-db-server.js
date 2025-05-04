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

    // Special case for average play time query
    if (query.toLowerCase().includes('average play time') || 
        query.toLowerCase().includes('average playtime')) {
      console.log('Detected average play time query');
      
      if (collection === 'events') {
        pipeline = [
          // Match events with duration field
          { $match: { duration: { $exists: true, $gt: 0 } } },
          
          // Group by player to calculate average play time per player
          { $group: {
              _id: '$playerId',
              playerAvgPlayTime: { $avg: '$duration' },
              totalEvents: { $sum: 1 }
            }
          },
          
          // Calculate overall average play time across all players
          { $group: {
              _id: null,
              averagePlayTime: { $avg: '$playerAvgPlayTime' },
              totalPlayers: { $sum: 1 },
              minPlayTime: { $min: '$playerAvgPlayTime' },
              maxPlayTime: { $max: '$playerAvgPlayTime' }
            }
          },
          
          // Format the output
          { $project: {
              _id: 0,
              averagePlayTime: { $round: ['$averagePlayTime', 2] },
              totalPlayers: 1,
              minPlayTime: { $round: ['$minPlayTime', 2] },
              maxPlayTime: { $round: ['$maxPlayTime', 2] },
              unit: { $literal: 'seconds' }
            }
          }
        ];
        explanation = 'MongoDB aggregation pipeline for calculating average play time across all players';
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
    const results = await mongoCollection.aggregate(pipeline).toArray();
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
      processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
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
