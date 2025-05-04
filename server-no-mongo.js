const express = require('express');
const cors = require('cors');

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

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Login route
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Simple authentication for testing
  if (username === 'test' && password === 'test') {
    const token = 'test-token';
    return res.json({ token });
  }

  res.status(401).json({ message: 'Invalid credentials' });
});

// Query route
app.post('/api/query', async (req, res) => {
  try {
    const { query, collection = 'events', schemaInfo } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    console.log('Processing query:', query);
    console.log('Collection:', collection);
    console.log('Schema Info:', schemaInfo);

    // Create sample data based on the collection
    let results = [];
    if (collection === 'events') {
      results = [
        { _id: '1', type: 'zone', context: { zoneId: 'S1-R1-LivRm' }, playerId: 'player1', timestamp: new Date() },
        { _id: '2', type: 'zone', context: { zoneId: 'S1-R2-Kitchen' }, playerId: 'player2', timestamp: new Date() },
        { _id: '3', type: 'item', context: { itemId: 'key1' }, playerId: 'player1', timestamp: new Date() }
      ];
    } else if (collection === 'players') {
      results = [
        { _id: 'player1', name: 'Player 1', region: 'US', score: 100 },
        { _id: 'player2', name: 'Player 2', region: 'EU', score: 85 },
        { _id: 'player3', name: 'Player 3', region: 'US', score: 120 }
      ];
    } else if (collection === 'items') {
      results = [
        { _id: 'key1', name: 'Master Key', location: 'Kitchen' },
        { _id: 'book1', name: 'Diary', location: 'Living Room' },
        { _id: 'tool1', name: 'Screwdriver', location: 'Garage' }
      ];
    } else {
      results = [
        { _id: '1', name: 'Sample 1' },
        { _id: '2', name: 'Sample 2' },
        { _id: '3', name: 'Sample 3' }
      ];
    }

    // Create a simple pipeline based on the query
    let pipeline = [];
    
    // Add a simple match stage based on the query
    if (query.toLowerCase().includes('zone')) {
      pipeline = [
        { $match: { type: 'zone' } },
        { $limit: 20 }
      ];
    } else if (query.toLowerCase().includes('item')) {
      pipeline = [
        { $match: { type: 'item' } },
        { $limit: 20 }
      ];
    } else {
      // Default pipeline
      pipeline = [{ $match: {} }, { $limit: 20 }];
    }

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
