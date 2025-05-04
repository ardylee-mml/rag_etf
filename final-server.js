require('dotenv').config();
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
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb')
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
    console.log('Collection:', collection);
    
    const lowerQuery = query.toLowerCase();
    const db = mongoose.connection.db;
    
    // Pattern 1: Item pickup query
    if (lowerQuery.includes('item') && lowerQuery.includes('pickup')) {
      console.log('Detected item pickup query');
      
      // Extract limit from query (default to 5 if not specified)
      let limit = 5;
      const limitMatch = lowerQuery.match(/top\s+(\d+)/);
      if (limitMatch) {
        limit = parseInt(limitMatch[1]);
      }
      
      const results = await db.collection('events').aggregate([
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
      ]).toArray();
      
      return res.json({
        query,
        results,
        explanation: 'Specialized pipeline for item pickup query'
      });
    }
    
    // Pattern 2: Player activity query
    else if (lowerQuery.includes('player') && lowerQuery.includes('more than')) {
      console.log('Detected player activity query');
      
      // Extract threshold from query (default to 3 if not specified)
      let threshold = 3;
      const thresholdMatch = lowerQuery.match(/more than (\d+)/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      const results = await db.collection('events').aggregate([
        { $group: {
          _id: "$playerId",
          playCount: { $sum: 1 }
        }},
        { $match: {
          playCount: { $gt: threshold }
        }},
        { $count: "playerCount" }
      ]).toArray();
      
      return res.json({
        query,
        results,
        explanation: 'Specialized pipeline for player activity query'
      });
    }
    
    // Pattern 3: Question performance query
    else if (lowerQuery.includes('question') && 
            (lowerQuery.includes('frequent') || lowerQuery.includes('average'))) {
      console.log('Detected question performance query');
      
      const results = await db.collection('events').aggregate([
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
      ]).toArray();
      
      return res.json({
        query,
        results,
        explanation: 'Specialized pipeline for question performance query'
      });
    }
    
    // Pattern 4: Signin activity query
    else if (lowerQuery.includes('signin') && lowerQuery.includes('month')) {
      console.log('Detected signin activity query');
      
      // Calculate date one month ago
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const results = await db.collection('events').aggregate([
        { $match: { 
          type: 'signin',
          time: { $gte: oneMonthAgo.toISOString() }
        }},
        { $group: {
          _id: { $substr: ['$time', 0, 10] }, // Group by date
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]).toArray();
      
      return res.json({
        query,
        results,
        explanation: 'Specialized pipeline for signin activity query'
      });
    }
    
    // Pattern 5: Zone engagement query
    else if (lowerQuery.includes('zone') && 
            (lowerQuery.includes('engagement') || lowerQuery.includes('highest'))) {
      console.log('Detected zone engagement query');
      
      // Step 1: Find zones with highest player engagement
      const topZones = await db.collection('events').aggregate([
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
      ]).toArray();
      
      console.log('Top zones:', topZones);
      
      // Step 2: Get zone names
      const zoneIds = topZones.map(zone => zone.zoneId);
      const zoneDetails = await db.collection('zones').find({ 
        _id: { $in: zoneIds } 
      }).toArray();
      
      console.log('Zone details:', zoneDetails);
      
      // Step 3: Get item pickups for these zones
      const itemPickups = await db.collection('events').aggregate([
        { $match: { 
          'context.zoneId': { $in: zoneIds },
          'type': 'item',
          'context.action': 'pickup'
        }},
        { $group: {
          _id: '$context.zoneId',
          itemPickupCount: { $sum: 1 }
        }}
      ]).toArray();
      
      console.log('Item pickups:', itemPickups);
      
      // Step 4: Combine the results
      const results = topZones.map(zone => {
        const zoneInfo = zoneDetails.find(z => z._id === zone.zoneId) || {};
        const pickups = itemPickups.find(p => p._id === zone.zoneId);
        
        return {
          zoneId: zone.zoneId,
          zoneName: zoneInfo.name || 'Unknown Zone',
          playerEngagement: zone.playerEngagement,
          itemPickups: pickups ? pickups.itemPickupCount : 0
        };
      });
      
      console.log('Final results:', results);
      
      return res.json({
        query,
        results,
        explanation: 'Specialized zone engagement query'
      });
    }
    
    // Default fallback
    else {
      console.log('Using default fallback');
      
      const results = await db.collection(collection).find().limit(20).toArray();
      
      return res.json({
        query,
        results,
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
