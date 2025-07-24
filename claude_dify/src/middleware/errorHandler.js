const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, code = null, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'CAST_ERROR', { path: err.path, value: err.value });
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}`;
  return new AppError(message, 400, 'DUPLICATE_FIELD', { value });
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR', { errors });
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401, 'JWT_INVALID');

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401, 'JWT_EXPIRED');

const handlePlaywrightError = (err) => {
  let message = 'Playwright automation failed';
  let code = 'PLAYWRIGHT_ERROR';
  let details = {};

  if (err.message.includes('timeout')) {
    message = 'Page load timeout exceeded';
    code = 'PLAYWRIGHT_TIMEOUT';
    details.timeout = err.timeout || 30000;
  } else if (err.message.includes('net::')) {
    message = 'Network error during page load';
    code = 'PLAYWRIGHT_NETWORK_ERROR';
    details.networkError = err.message;
  } else if (err.message.includes('Navigation failed')) {
    message = 'Failed to navigate to the specified URL';
    code = 'PLAYWRIGHT_NAVIGATION_ERROR';
  }

  return new AppError(message, 502, code, {
    originalError: err.message,
    ...details
  });
};

const handleGCSError = (err) => {
  let message = 'Google Cloud Storage operation failed';
  let code = 'GCS_ERROR';
  let statusCode = 500;

  if (err.code === 404) {
    message = 'GCS bucket or object not found';
    code = 'GCS_NOT_FOUND';
    statusCode = 404;
  } else if (err.code === 403) {
    message = 'Insufficient permissions for GCS operation';
    code = 'GCS_PERMISSION_DENIED';
    statusCode = 403;
  }

  return new AppError(message, statusCode, code, {
    gcsError: err.message,
    bucket: err.bucket,
    object: err.object
  });
};

const sendErrorDev = (err, req, res) => {
  logger.error('Development Error:', {
    error: err,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params
    }
  });

  res.status(err.statusCode).json({
    success: false,
    error: err,
    message: err.message,
    code: err.code,
    details: err.details,
    stack: err.stack,
    timestamp: err.timestamp,
    request: {
      method: req.method,
      url: req.originalUrl,
      body: req.method === 'POST' ? req.body : undefined,
      query: Object.keys(req.query).length > 0 ? req.query : undefined
    },
    debugging: {
      nodeEnv: process.env.NODE_ENV,
      debug: process.env.DEBUG,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
};

const sendErrorProd = (err, req, res) => {
  // Log the full error for monitoring
  logger.error('Production Error:', {
    message: err.message,
    statusCode: err.statusCode,
    code: err.code,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    stack: err.stack
  });

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
      timestamp: err.timestamp,
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  } else {
    // Programming or other unknown error: don't leak error details
    res.status(500).json({
      success: false,
      error: 'Something went wrong!',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'TimeoutError' || error.message?.includes('playwright')) {
      error = handlePlaywrightError(error);
    }
    if (error.message?.includes('Google Cloud Storage')) {
      error = handleGCSError(error);
    }

    sendErrorProd(error, req, res);
  }
};

module.exports.AppError = AppError;