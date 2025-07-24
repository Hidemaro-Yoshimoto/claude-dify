const logger = require('../utils/logger');

const debugHandler = (req, res, next) => {
  const startTime = Date.now();
  
  // Skip debug logging for health checks in production
  if (process.env.NODE_ENV === 'production' && req.path === '/health') {
    return next();
  }

  // Log incoming request in debug mode
  if (process.env.DEBUG === 'true') {
    logger.debug('🔍 Incoming Request', {
      method: req.method,
      url: req.originalUrl,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'accept': req.get('Accept'),
        'origin': req.get('Origin'),
        'host': req.get('Host')
      },
      body: req.method === 'POST' ? req.body : undefined,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      params: Object.keys(req.params).length > 0 ? req.params : undefined,
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    });
  }

  // Capture original res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Log API request with timing
    logger.apiRequest(req, res, duration);
    
    // Log response in debug mode
    if (process.env.DEBUG === 'true') {
      logger.debug('📤 Outgoing Response', {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentType: res.get('Content-Type'),
        bodySize: JSON.stringify(data).length + ' bytes',
        data: res.statusCode >= 400 ? data : 'Response body logged separately',
        timestamp: new Date().toISOString()
      });
      
      // Log successful response body separately for better formatting
      if (res.statusCode < 400) {
        logger.debugObject('Response Body', data);
      }
    }
    
    // Performance warning for slow requests
    if (duration > 10000) { // 10 seconds
      logger.warn('🐌 Slow Request Detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        memoryUsage: process.memoryUsage()
      });
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };

  // Add debug headers to response
  if (process.env.DEBUG === 'true') {
    res.set({
      'X-Debug-Mode': 'true',
      'X-Request-ID': req.headers['x-request-id'] || `req-${Date.now()}`,
      'X-Node-Version': process.version,
      'X-Memory-Usage': `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    });
  }

  next();
};

module.exports = debugHandler;