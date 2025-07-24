const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const debugHandler = require('./middleware/debugHandler');
const analyzeController = require('./controllers/analyzeController');
const healthController = require('./controllers/healthController');

const app = express();
const PORT = process.env.PORT || 8080;

// Security & Performance Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : true,
  credentials: true
}));

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware (logs all requests when DEBUG=true)
app.use(debugHandler);

// Routes
app.get('/health', healthController.healthCheck);
app.get('/debug', healthController.debugInfo);
app.post('/analyze', analyzeController.analyzeUrl);

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      'GET /health': 'Health check',
      'GET /debug': 'Debug information',
      'POST /analyze': 'Analyze URL with Playwright'
    }
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔍 Debug mode: ${process.env.DEBUG === 'true' ? 'ON' : 'OFF'}`);
  
  if (process.env.DEBUG === 'true') {
    logger.debug('Available endpoints:');
    logger.debug('  GET  /health - Health check');
    logger.debug('  GET  /debug  - Debug information');
    logger.debug('  POST /analyze - Analyze URL');
  }
});

module.exports = app;