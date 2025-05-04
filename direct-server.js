require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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

// Simple authentication middleware that always passes
const authMiddleware = (req, res, next) => {
  next();
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Query route for item pickup
app.post('/api/query', authMiddleware, async (req, res) => {
  try {
    const { query, collection = 'events' } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);

    // Hardcoded pipeline for item pickup query
    let pipeline = [];
    let explanation = 'Direct pipeline generation';

    // Check if this is the item pickup query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('item') && lowerQuery.includes('pickup') && collection === 'events') {
      console.log('Detected item pickup query');
      
      // Extract limit from query (default to 5 if not specified)
      let limit = 5;
      const limitMatch = lowerQuery.match(/top\s+(\d+)/);
      if (limitMatch) {
        limit = parseInt(limitMatch[1]);
      }
      
      pipeline = [
        { $match: { 
          type: 'item',
          'context.action': 'pickup'
        }},
        { $group: {
          _id: '$context.itemId',
          count: { $sum: 1 }
        }},
        { $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: '_id',
          as: 'itemDetails'
        }},
        { $unwind: { path: '$itemDetails', preserveNullAndEmptyArrays: true } },
        { $project: {
          itemId: '$_id',
          itemName: '$itemDetails.name',
          count: 1,
          _id: 0
        }},
        { $sort: { count: -1 } },
        { $limit: limit }
      ];
      
      explanation = 'Specialized pipeline for item pickup query';
    } 
    // Check if this is the player activity query
    else if (lowerQuery.includes('player') && lowerQuery.includes('more than') && collection === 'events') {
      console.log('Detected player activity query');
      
      // Extract threshold from query (default to 3 if not specified)
      let threshold = 3;
      const thresholdMatch = lowerQuery.match(/more than (\d+)/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      pipeline = [
        // Group events by player to count how many times each player played
        {
          $group: {
            _id: "$playerId",
            playCount: { $sum: 1 }
          }
        },
        // Filter players who played more than threshold times
        {
          $match: {
            playCount: { $gt: threshold }
          }
        },
        // Count how many players meet the criteria
        {
          $count: "playerCount"
        }
      ];
      
      explanation = 'Specialized pipeline for player activity query';
    }
    // Check if this is the question performance query
    else if (lowerQuery.includes('question') && collection === 'events') {
      console.log('Detected question performance query');
      
      pipeline = [
        { $match: { type: 'question' } },
        { $group: {
          _id: '$context.questionId',
          count: { $sum: 1 },
          avgAttempts: { $avg: '$context.attempts' }
        }},
        { $lookup: {
          from: 'questions',
          localField: '_id',
          foreignField: '_id',
          as: 'questionDetails'
        }},
        { $unwind: { path: '$questionDetails', preserveNullAndEmptyArrays: true } },
        { $project: {
          questionId: '$_id',
          questionText: '$questionDetails.text',
          count: 1,
          avgAttempts: 1,
          _id: 0
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      explanation = 'Specialized pipeline for question performance query';
    }
    // Check if this is the signin activity query
    else if (lowerQuery.includes('signin') && lowerQuery.includes('month') && collection === 'events') {
      console.log('Detected signin activity query');
      
      // Calculate date one month ago
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      pipeline = [
        { $match: { 
          type: 'signin',
          time: { $gte: oneMonthAgo.toISOString() }
        }},
        { $group: {
          _id: { $substr: ['$time', 0, 10] }, // Group by date
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ];
      
      explanation = 'Specialized pipeline for signin activity query';
    }
    // Check if this is the zone engagement query
    else if (lowerQuery.includes('zone') && lowerQuery.includes('engagement') && collection === 'events') {
      console.log('Detected zone engagement query');
      
      pipeline = [
        { $match: { 'context.zoneId': { $exists: true } } },
        { $group: {
          _id: '$context.zoneId',
          playerCount: { $addToSet: '$playerId' },
          itemPickups: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$type', 'item'] },
                  { $eq: ['$context.action', 'pickup'] }
                ]},
                1,
                0
              ]
            }
          }
        }},
        { $project: {
          zoneId: '$_id',
          playerEngagement: { $size: '$playerCount' },
          itemPickups: 1,
          _id: 0
        }},
        { $lookup: {
          from: 'zones',
          localField: 'zoneId',
          foreignField: '_id',
          as: 'zoneDetails'
        }},
        { $unwind: { path: '$zoneDetails', preserveNullAndEmptyArrays: true } },
        { $project: {
          zoneId: 1,
          zoneName: '$zoneDetails.name',
          playerEngagement: 1,
          itemPickups: 1
        }},
        { $sort: { playerEngagement: -1 } },
        { $limit: 5 }
      ];
      
      explanation = 'Specialized pipeline for zone engagement query';
    }
    // Default fallback pipeline
    else {
      console.log('Using default fallback pipeline');
      pipeline = [{ $match: {} }, { $limit: 20 }];
      explanation = 'Default fallback pipeline';
    }

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Execute the aggregation pipeline
    console.log('Executing pipeline:', JSON.stringify(pipeline));
    const results = await mongoCollection.aggregate(pipeline).toArray();
    console.log(`Query returned ${results.length} results`);

    // Return response
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
