const express = require('express');
const app = express();
const PORT = 3000;

// Simple test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    server: {
      port: PORT,
      uptime: process.uptime()
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
