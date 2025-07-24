const winston = require('winston');

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n📋 Meta: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.DEBUG === 'true' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'checker-api',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Cloud Run specific logging
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

// Helper functions for structured logging
logger.apiRequest = (req, res, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    body: req.method === 'POST' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined
  };
  
  if (res.statusCode >= 400) {
    logger.error('API Request Failed', logData);
  } else {
    logger.info('API Request', logData);
  }
};

logger.playwrightAction = (action, url, data = {}) => {
  logger.debug(`🎭 Playwright ${action}`, {
    url,
    ...data
  });
};

logger.performanceMetric = (metric, value, unit = 'ms') => {
  logger.info(`📊 Performance: ${metric}`, {
    metric,
    value,
    unit,
    timestamp: new Date().toISOString()
  });
};

logger.securityEvent = (event, details = {}) => {
  logger.warn(`🔒 Security Event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.costTracking = (operation, cost, currency = 'USD') => {
  logger.info(`💰 Cost Tracking: ${operation}`, {
    operation,
    cost,
    currency,
    timestamp: new Date().toISOString()
  });
};

logger.systemHealth = (component, status, metrics = {}) => {
  const level = status === 'healthy' ? 'info' : 'warn';
  logger[level](`🏥 Health Check: ${component}`, {
    component,
    status,
    ...metrics,
    timestamp: new Date().toISOString()
  });
};

// Debug helper for development
logger.debugObject = (label, obj) => {
  if (process.env.DEBUG === 'true') {
    logger.debug(`🔍 ${label}:`, {
      object: JSON.stringify(obj, null, 2)
    });
  }
};

module.exports = logger;