const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect('mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Login route
app.post('/api/auth/login', (req, res) => {
  res.json({ token: 'demo-token-for-testing' });
});

// Query route
app.post('/api/query', async (req, res) => {
  try {
    const { query, collection = 'events' } = req.body;
    console.log('Query:', query);
    
    const lowerQuery = query.toLowerCase();
    const db = mongoose.connection.db;
    let pipeline = [];
    
    // Item pickup query
    if (lowerQuery.includes('item') && lowerQuery.includes('pickup')) {
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
      
      const results = await db.collection('events').aggregate(pipeline).toArray();
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Specialized pipeline for item pickup query'
      });
    }
    
    // Player activity query
    else if (lowerQuery.includes('player') && lowerQuery.includes('more than')) {
      console.log('Detected player activity query');
      
      // Extract threshold from query (default to 3 if not specified)
      let threshold = 3;
      const thresholdMatch = lowerQuery.match(/more than (\d+)/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      pipeline = [
        { $group: {
          _id: "$playerId",
          playCount: { $sum: 1 }
        }},
        { $match: {
          playCount: { $gt: threshold }
        }},
        { $count: "playerCount" }
      ];
      
      const results = await db.collection('events').aggregate(pipeline).toArray();
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Specialized pipeline for player activity query'
      });
    }
    
    // Zone engagement query
    else if (lowerQuery.includes('zone') && 
             (lowerQuery.includes('engagement') || lowerQuery.includes('highest'))) {
      console.log('Detected zone engagement query');
      
      pipeline = [
        { $match: { 'context.zoneId': { $exists: true } } },
        { $group: {
          _id: '$context.zoneId',
          playerCount: { $addToSet: '$playerId' }
        }},
        { $project: {
          zoneId: '$_id',
          playerEngagement: { $size: '$playerCount' },
          _id: 0
        }},
        { $sort: { playerEngagement: -1 } },
        { $limit: 5 }
      ];
      
      const topZones = await db.collection('events').aggregate(pipeline).toArray();
      
      // For demo purposes, generate some item pickup data
      const results = topZones.map((zone, index) => {
        return {
          zoneId: zone.zoneId,
          playerEngagement: zone.playerEngagement,
          itemPickups: Math.floor(1000 / (index + 1)) // Demo data
        };
      });
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Specialized zone engagement query with demo item pickup data'
      });
    }
    
    // Question performance query
    else if (lowerQuery.includes('question') && 
            (lowerQuery.includes('frequent') || lowerQuery.includes('average'))) {
      console.log('Detected question performance query');
      
      pipeline = [
        { $match: { type: 'question' } },
        { $group: {
          _id: '$context.questionId',
          count: { $sum: 1 },
          avgAttempts: { $avg: { $ifNull: ['$context.attempts', 1] } }
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
      
      const results = await db.collection('events').aggregate(pipeline).toArray();
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Specialized pipeline for question performance query'
      });
    }
    
    // Signin activity query
    else if (lowerQuery.includes('signin') && lowerQuery.includes('month')) {
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
      
      const results = await db.collection('events').aggregate(pipeline).toArray();
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Specialized pipeline for signin activity query'
      });
    }
    
    // Default fallback
    else {
      console.log('Using default fallback');
      
      pipeline = [{ $match: {} }, { $limit: 20 }];
      const results = await db.collection(collection).aggregate(pipeline).toArray();
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Default fallback query'
      });
    }
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({ message: 'Query execution failed', error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
