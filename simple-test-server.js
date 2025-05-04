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
app.use(cors());

// Simple authentication middleware that always passes
const authMiddleware = (req, res, next) => {
  // Skip authentication for testing
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
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Simple query route
app.post('/api/query', authMiddleware, async (req, res) => {
  try {
    const { query, collection = 'events', schemaInfo } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);
    console.log('Schema Info:', schemaInfo);

    // Process the query directly using extractMongoDBPipeline
    let pipeline = null;
    let explanation = '';
    let results = [];

    // Use the extractMongoDBPipeline method directly
    pipeline = deepseekService.extractMongoDBPipeline(JSON.stringify([]), query, collection);
    explanation = `MongoDB aggregation pipeline generated based on natural language query: "${query}"`;

    // Get the specified collection
    const db = mongoose.connection.db;
    const mongoCollection = db.collection(collection);

    // Execute the aggregation pipeline
    results = await mongoCollection.aggregate(pipeline).toArray();

    // Log what we're sending to the client
    console.log(`Sending response to client with ${results.length} results`);

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
