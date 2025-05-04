const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000; // Changed to port 3000

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

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Simple query route
app.post('/api/query', async (req, res) => {
  try {
    const { query, collection } = req.body;

    console.log('Processing query:', query);
    console.log('Collection:', collection);

    // Create a simple mock response
    const mockResults = [
      { _id: '1', type: 'play', duration: 120, playerId: 'player1' },
      { _id: '2', type: 'play', duration: 180, playerId: 'player2' },
      { _id: '3', type: 'play', duration: 150, playerId: 'player3' }
    ];

    // Create a simple pipeline based on the query
    let pipeline = [];
    
    // Add a simple match stage based on the query
    if (query.toLowerCase().includes('average play time')) {
      pipeline = [
        { $match: { type: 'play' } },
        { $group: { _id: null, averagePlayTime: { $avg: '$duration' } } }
      ];
    } else {
      // Default pipeline
      pipeline = [{ $match: {} }, { $limit: 20 }];
    }

    // Return response with all the fields needed for debug info
    res.json({
      query,
      timestamp: new Date(),
      results: mockResults,
      processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
      pipeline: pipeline,
      explanation: 'Simple query processing without LLM'
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
