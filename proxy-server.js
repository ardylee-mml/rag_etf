const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Add console output when server starts
console.log('Starting proxy server...');

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Add a status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Proxy server is running',
    timestamp: new Date()
  });
});

// Proxy API requests to our server
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.url} to http://localhost:3000${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`Received response from API: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ message: 'Proxy error', error: err.message });
  }
}));

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Forwarding API requests to http://localhost:3000`);
  console.log(`Test with: curl http://localhost:${PORT}/api/status`);
});
