import { Request, Response } from 'express';
import { playwrightService } from '../services/playwrightService';
import { asyncHandler } from '../middleware/errorHandler';

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  const healthData = {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    cpu: {
      user: process.cpuUsage().user / 1000000,
      system: process.cpuUsage().system / 1000000
    }
  };

  console.log('Health check requested', {
    memory: `${healthData.memory.used}MB`,
    uptime: `${Math.round(healthData.uptime)}s`
  });

  res.json(healthData);
});

export const readinessCheck = asyncHandler(async (req: Request, res: Response) => {
  // Check if Playwright service is ready
  const playwrightHealth = await playwrightService.healthCheck();
  
  const isReady = playwrightHealth.status === 'healthy';
  
  const readinessData = {
    success: isReady,
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    services: {
      playwright: playwrightHealth
    }
  };

  console.log('Readiness check:', readinessData);

  res.status(isReady ? 200 : 503).json(readinessData);
});

export const debugInfo = asyncHandler(async (req: Request, res: Response) => {
  const debugData = {
    success: true,
    timestamp: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT || 8080,
      npm_package_version: process.env.npm_package_version
    },
    playwright: await playwrightService.healthCheck(),
    api: {
      endpoints: [
        'GET /health - Health check',
        'GET /ready - Readiness check',
        'GET /debug - Debug information',
        'POST /analyze - Analyze URL'
      ]
    },
    sampleRequest: {
      method: 'POST',
      url: '/analyze',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        url: 'https://example.com',
        options: {
          timeout: 30000,
          waitFor: '.main-content',
          viewport: {
            width: 1920,
            height: 1080
          },
          screenshot: true
        }
      }
    }
  };

  console.log('Debug info requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json(debugData);
});