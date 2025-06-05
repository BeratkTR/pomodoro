const express = require('express');
const apiRoutes = require('./api');

const router = express.Router();

// Mount API routes
router.use('/api', apiRoutes);

// Root route for health check
router.get('/', (req, res) => {
  res.json({
    message: 'Pomodoro App Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unknown routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this server`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'GET /api/rooms',
      'POST /api/rooms'
    ]
  });
});

module.exports = router; 