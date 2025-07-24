import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error.message.includes('timeout')) {
    statusCode = 504;
    code = 'TIMEOUT_ERROR';
    message = 'Request timeout';
  } else if (error.message.includes('net::')) {
    statusCode = 502;
    code = 'NETWORK_ERROR';
    message = 'Network error';
  } else if (error.message.includes('Navigation failed')) {
    statusCode = 502;
    code = 'NAVIGATION_ERROR';
    message = 'Failed to navigate to URL';
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error 
      })
    },
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};