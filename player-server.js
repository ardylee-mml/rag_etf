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
    
    // Player activity query
    if (lowerQuery.includes('player') && lowerQuery.includes('more than')) {
      console.log('Detected player activity query');
      
      // Extract threshold from query (default to 3 if not specified)
      let threshold = 3;
      const thresholdMatch = lowerQuery.match(/more than (\d+)/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      // Create the pipeline
      const pipeline = [
        { $group: {
          _id: "$playerId",
          playCount: { $sum: 1 }
        }},
        { $match: {
          playCount: { $gt: threshold }
        }},
        { $count: "playerCount" }
      ];
      
      // Execute the pipeline
      const results = await db.collection('events').aggregate(pipeline).toArray();
      
      return res.json({
        query,
        results,
        pipeline,
        explanation: 'Specialized pipeline for player activity query'
      });
    }
    
    // Zone engagement query
    else if (lowerQuery.includes('zone') && lowerQuery.includes('engagement')) {
      console.log('Detected zone engagement query');
      
      // Create the pipeline
      const pipeline = [
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
      
      // Execute the pipeline
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
    
    // Default fallback
    else {
      console.log('Using default fallback');
      
      const pipeline = [{ $match: {} }, { $limit: 20 }];
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
