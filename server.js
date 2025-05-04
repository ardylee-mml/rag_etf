require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mmldb')
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

    // Get the database connection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Create a simple pipeline based on the query
    let pipeline = [];
    
    // Add a simple match stage based on the query
    if (query.toLowerCase().includes('average play time')) {
      pipeline = [
        { $match: { type: 'play' } },
        { $group: { _id: null, averagePlayTime: { $avg: '$duration' } } }
      ];
    } else if (query.toLowerCase().includes('zone')) {
      pipeline = [
        { $match: { type: 'zone' } },
        { $limit: 20 }
      ];
    } else {
      // Default pipeline
      pipeline = [{ $match: {} }, { $limit: 20 }];
    }

    // Execute the query with real data
    const results = await mongoCollection.aggregate(pipeline).toArray();

    // Return response with all the fields needed for debug info
    res.json({
      query,
      timestamp: new Date(),
      results,
      processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
      pipeline: pipeline,
      explanation: 'Query processed with MongoDB aggregation pipeline'
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
