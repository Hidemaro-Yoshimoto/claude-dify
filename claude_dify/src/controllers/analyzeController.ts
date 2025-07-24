import { Request, Response } from 'express';
import { AnalyzeRequest } from '../types';
import { playwrightService } from '../services/playwrightService';
import { AppError, asyncHandler } from '../middleware/errorHandler';

interface AnalyzeRequestBody extends AnalyzeRequest {}

export const analyzeUrl = asyncHandler(async (req: Request<{}, {}, AnalyzeRequestBody>, res: Response) => {
  const { url, options = {} } = req.body;

  // Validate URL
  if (!url) {
    throw new AppError('URL is required', 400, 'MISSING_URL');
  }

  if (typeof url !== 'string') {
    throw new AppError('URL must be a string', 400, 'INVALID_URL_TYPE');
  }

  // Basic URL validation
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new AppError('Only HTTP and HTTPS URLs are supported', 400, 'INVALID_PROTOCOL');
    }

    // Block private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = urlObj.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
      ) {
        throw new AppError('Private IP addresses are not allowed', 400, 'PRIVATE_IP_BLOCKED');
      }
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid URL format', 400, 'INVALID_URL');
  }

  // Validate options
  if (options.timeout && (options.timeout < 1000 || options.timeout > 120000)) {
    throw new AppError('Timeout must be between 1000ms and 120000ms', 400, 'INVALID_TIMEOUT');
  }

  if (options.viewport) {
    const { width, height } = options.viewport;
    if (width < 100 || width > 4000 || height < 100 || height > 4000) {
      throw new AppError('Viewport dimensions must be between 100 and 4000 pixels', 400, 'INVALID_VIEWPORT');
    }
  }

  console.log(`📋 Analysis request: ${url}`, {
    options,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Perform analysis
  const result = await playwrightService.analyze({ url, options });

  console.log(`✅ Analysis completed: ${url}`, {
    processingTime: result.processingTime,
    title: result.data.title,
    accessibilityScore: result.data.accessibility.score
  });

  res.json(result);
});