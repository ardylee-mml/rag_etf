const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Query endpoint
app.post('/api/query', (req, res) => {
  const { query, collection } = req.body;
  console.log('Query received:', query);
  console.log('Collection:', collection);
  
  // Mock response
  const mockResults = [
    { _id: '1', type: 'play', duration: 120, playerId: 'player1' },
    { _id: '2', type: 'play', duration: 180, playerId: 'player2' },
    { _id: '3', type: 'play', duration: 150, playerId: 'player3' }
  ];
  
  // Create a simple pipeline
  const pipeline = [
    { $match: { type: 'play' } },
    { $group: { _id: null, averagePlayTime: { $avg: '$duration' } } }
  ];
  
  res.json({
    query,
    timestamp: new Date(),
    results: mockResults,
    processedQuery: `db.${collection}.aggregate(${JSON.stringify(pipeline)})`,
    pipeline: pipeline,
    explanation: 'Simple query processing without LLM'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
