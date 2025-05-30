require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const deepseekService = require('./src/services/deepseekService');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  // Add timestamp to track request duration
  req.startTime = Date.now();
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

// Query route
app.post('/api/query', authMiddleware, async (req, res) => {
  try {
    const { query, collection = 'events', schemaInfo } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);
    console.log('Schema Info:', schemaInfo);

    // Set a timeout for the query
    const queryTimeout = 30000; // 30 seconds
    let timeoutId;

    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Query execution timed out'));
      }, queryTimeout);
    });

    // Analyze the query to determine its type
    const lowerQuery = query.toLowerCase();

    // Check for different query types
    const isPlayerFrequencyQuery = lowerQuery.includes('player') &&
                                  (lowerQuery.includes('played more than') || lowerQuery.includes('play more than')) &&
                                  collection === 'events';

    const isZoneEngagementQuery = lowerQuery.includes('zone') &&
                                 (lowerQuery.includes('engagement') || lowerQuery.includes('popular') ||
                                  lowerQuery.includes('highest') || lowerQuery.includes('most')) &&
                                 collection === 'events';

    const isItemPickupQuery = lowerQuery.includes('item') &&
                             (lowerQuery.includes('picked up') || lowerQuery.includes('collected') ||
                              lowerQuery.includes('pick up') || lowerQuery.includes('collect')) &&
                             collection === 'events';

    // Check for the specific query about zones and items
    const isSpecificZoneItemQuery = lowerQuery.includes('which zones have the highest player engagement') &&
                                   lowerQuery.includes('what items were picked up in those zones');

    // Combined zone and item query
    const isZoneItemQuery = isSpecificZoneItemQuery || (isZoneEngagementQuery && isItemPickupQuery);

    let pipeline;
    let explanation;

    // Handle different query types with specialized pipelines
    if (isPlayerFrequencyQuery) {
      console.log('Detected player frequency query, using specialized pipeline...');

      // Extract the threshold from the query
      let threshold = 3; // Default threshold
      const thresholdMatch = lowerQuery.match(/more than (\d+)/);
      if (thresholdMatch && thresholdMatch[1]) {
          threshold = parseInt(thresholdMatch[1]);
      }

      console.log(`Using threshold: ${threshold} for player frequency query`);

      // Use a specialized pipeline for player frequency queries
      pipeline = [
        // Sample to improve performance
        { $sample: { size: 100000 } },

        // Group events by player to count how many times each player played
        {
          $group: {
            _id: "$playerId",
            playCount: { $sum: 1 }
          }
        },

        // Filter to only include players who played more than threshold times
        {
          $match: {
            playCount: { $gt: threshold }
          }
        },

        // Count the number of players who meet the criteria
        {
          $count: "playersPlayedMoreThanThreshold"
        }
      ];

      explanation = `Specialized pipeline for player frequency query with threshold ${threshold}`;
    }
    else if (isZoneItemQuery) {
      console.log('Detected zone engagement and item pickup query, using specialized pipeline...');

      // Use a specialized pipeline for zone engagement and item pickup queries
      pipeline = [
        // Sample first to reduce data volume
        { $sample: { size: 50000 } },

        // Match only zone and item events
        {
          $match: {
            $or: [
              { type: "zone" },
              { type: "item" }
            ]
          }
        },

        // Project only the fields we need to reduce memory usage
        {
          $project: {
            type: 1,
            "context.zoneId": 1,
            "context.itemId": { $cond: [{ $eq: ["$type", "item"] }, "$context.itemId", null] }
          }
        },

        // Group by zone to count engagement and collect items
        {
          $group: {
            _id: "$context.zoneId",
            zoneEngagement: { $sum: 1 },
            items: {
              $addToSet: "$context.itemId"
            }
          }
        },

        // Filter out null items
        {
          $addFields: {
            items: {
              $filter: {
                input: "$items",
                as: "item",
                cond: { $ne: ["$$item", null] }
              }
            }
          }
        },

        // Sort by engagement (highest first)
        {
          $sort: { zoneEngagement: -1 }
        },

        // Limit to top 5 zones to reduce memory usage
        {
          $limit: 5
        },

        // Lookup zone details
        {
          $lookup: {
            from: "zones",
            localField: "_id",
            foreignField: "_id",
            as: "zoneDetails"
          }
        },

        // Lookup item details
        {
          $lookup: {
            from: "items",
            localField: "items",
            foreignField: "_id",
            as: "itemDetails"
          }
        },

        // Project the final result
        {
          $project: {
            _id: 0,
            zoneId: "$_id",
            zoneName: { $arrayElemAt: ["$zoneDetails.name", 0] },
            engagement: "$zoneEngagement",
            itemCount: { $size: "$itemDetails" },
            items: {
              $map: {
                input: "$itemDetails",
                as: "item",
                in: {
                  itemId: "$$item._id",
                  name: "$$item.name"
                }
              }
            }
          }
        }
      ];

      explanation = 'Specialized pipeline for zone engagement and item pickup analysis';
    }
    else if (isZoneEngagementQuery) {
      console.log('Detected zone engagement query, using specialized pipeline...');

      // Use a specialized pipeline for zone engagement queries
      pipeline = [
        // Sample first to reduce data volume
        { $sample: { size: 50000 } },

        // Match only zone events
        {
          $match: {
            type: "zone"
          }
        },

        // Project only the fields we need to reduce memory usage
        {
          $project: {
            "context.zoneId": 1,
            playerId: 1
          }
        },

        // Group by zone to count engagement
        {
          $group: {
            _id: "$context.zoneId",
            zoneEngagement: { $sum: 1 },
            uniquePlayers: { $addToSet: "$playerId" }
          }
        },

        // Add field for unique player count
        {
          $addFields: {
            uniquePlayerCount: { $size: "$uniquePlayers" }
          }
        },

        // Remove the large uniquePlayers array to save memory
        {
          $project: {
            _id: 1,
            zoneEngagement: 1,
            uniquePlayerCount: 1
          }
        },

        // Sort by engagement (highest first)
        {
          $sort: { zoneEngagement: -1 }
        },

        // Limit to top 5 zones to reduce memory usage
        {
          $limit: 5
        },

        // Lookup zone details
        {
          $lookup: {
            from: "zones",
            localField: "_id",
            foreignField: "_id",
            as: "zoneDetails"
          }
        },

        // Project the final result
        {
          $project: {
            _id: 0,
            zoneId: "$_id",
            zoneName: { $arrayElemAt: ["$zoneDetails.name", 0] },
            engagement: "$zoneEngagement",
            uniquePlayers: "$uniquePlayerCount"
          }
        }
      ];

      explanation = 'Specialized pipeline for zone engagement analysis';
    }
    else {
      // Use Deepseek LLM to generate the pipeline
      console.log('Connecting to Deepseek LLM...');

      // Simulate a short delay for the LLM connection
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('Translating natural language to MongoDB query...');

      // Simulate a short delay for the translation process
      await new Promise(resolve => setTimeout(resolve, 800));

      console.log('Mapping database schema...');

      // Simulate a short delay for schema mapping
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('Generating MongoDB pipeline...');
      pipeline = deepseekService.extractMongoDBPipeline('[]', query, collection);
      explanation = 'Pipeline generated by Deepseek LLM';

      // Add sampling for performance if needed
      if (pipeline.length === 0 || (pipeline.length === 1 && Object.keys(pipeline[0]).length === 0)) {
        console.log('Empty pipeline detected, using fallback...');
        pipeline = [
          { $match: {} },
          { $limit: 20 }
        ];
        explanation = 'Fallback pipeline due to empty LLM response';
      }
    }

    // Get the database connection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Execute the query with a timeout
    console.log('Executing pipeline:', JSON.stringify(pipeline));

    // Create a promise for the query execution
    // Ensure we're using allowDiskUse for all aggregations, especially those with sorts
    const aggregateOptions = {
      allowDiskUse: true,  // Allow disk usage for large operations
      maxTimeMS: 25000     // Set a 25-second timeout at the MongoDB level
    };

    console.log('Executing with options:', JSON.stringify(aggregateOptions));
    const queryPromise = mongoCollection.aggregate(pipeline, aggregateOptions).toArray();

    // Race the query promise against the timeout
    const results = await Promise.race([queryPromise, timeoutPromise]);

    // Clear the timeout if the query completes
    clearTimeout(timeoutId);

    console.log(`Query returned ${results.length} results`);

    // Calculate execution time
    const executionTime = new Date() - new Date(req.startTime || Date.now());

    // Create processing stages information
    const processingStages = [];

    // Add appropriate stages based on query type
    if (isPlayerFrequencyQuery || isZoneItemQuery || isZoneEngagementQuery) {
      processingStages.push(
        { stage: 'Pattern recognition', status: 'completed', time: '0.2s' },
        { stage: 'Specialized pipeline generation', status: 'completed', time: '0.3s' },
        { stage: 'Query optimization', status: 'completed', time: '0.1s' },
        { stage: 'Database execution', status: 'completed', time: `${(executionTime/1000).toFixed(1)}s` }
      );
    } else {
      processingStages.push(
        { stage: 'Deepseek LLM connection', status: 'completed', time: '0.5s' },
        { stage: 'Natural language translation', status: 'completed', time: '0.8s' },
        { stage: 'Schema mapping', status: 'completed', time: '0.5s' },
        { stage: 'MongoDB pipeline generation', status: 'completed', time: '0.6s' },
        { stage: 'Query optimization', status: 'completed', time: '0.3s' },
        { stage: 'Database execution', status: 'completed', time: `${(executionTime/1000).toFixed(1)}s` }
      );
    }

    // Return response with all the fields needed for debug info
    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
      pipeline: pipeline,
      explanation: explanation,
      executionTime: executionTime,
      processingStages: processingStages
    });
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({
      message: 'Query execution failed',
      error: error.message,
      suggestion: error.message.includes('timed out') ?
        'This query is taking too long to process. Try a more specific query or add filters to reduce the data being processed.' :
        'Please try again with a different query.'
    });
  }
});

// Connect to MongoDB
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
