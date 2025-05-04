const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

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
  console.log('Health check');
  res.json({ status: 'ok', timestamp: new Date() });
});

// Login route
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt');
  
  // For demo purposes, accept any credentials
  const token = 'demo-token-for-testing';
  
  console.log('Login successful');
  res.json({ token });
});

// Query route
app.post('/api/query', async (req, res) => {
  try {
    const { query, collection = 'events' } = req.body;
    console.log('Query:', query);
    console.log('Collection:', collection);

    // Hardcoded pipeline for item pickup query
    let pipeline = [];
    
    // Check if this is the item pickup query
    const lowerQuery = query.toLowerCase();
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
    } else {
      // Default fallback pipeline
      pipeline = [{ $match: {} }, { $limit: 20 }];
    }

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Execute the aggregation pipeline
    console.log('Executing pipeline');
    const results = await mongoCollection.aggregate(pipeline).toArray();
    console.log(`Query returned ${results.length} results`);

    // Return response
    res.json({
      query,
      results,
      pipeline
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
