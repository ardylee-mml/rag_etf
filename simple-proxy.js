const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3001;
const API_URL = 'http://localhost:3000';

// Enable CORS
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Status endpoint
app.get('/api/status', (req, res) => {
  console.log('Status endpoint called');
  res.json({
    status: 'ok',
    message: 'Simple proxy server is running',
    timestamp: new Date()
  });
});

// Forward all other API requests
app.all('/api/*', async (req, res) => {
  try {
    const path = req.path;
    const method = req.method.toLowerCase();
    const headers = { ...req.headers };
    delete headers.host;

    console.log(`Forwarding ${method.toUpperCase()} ${path} to ${API_URL}${path}`);

    const response = await axios({
      method,
      url: `${API_URL}${path}`,
      headers,
      data: method !== 'get' ? req.body : undefined,
      params: req.query
    });

    console.log(`Response from API: ${response.status}`);

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error forwarding request:', error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({
        message: 'Proxy error',
        error: error.message
      });
    }
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Simple proxy server running on port ${PORT}`);
  console.log(`Forwarding API requests to ${API_URL}`);
  console.log(`Test with: curl http://localhost:${PORT}/api/status`);
});

// Log any server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Log when the server is closed
process.on('SIGINT', () => {
  console.log('Shutting down proxy server...');
  server.close(() => {
    console.log('Proxy server closed');
    process.exit(0);
  });
});
