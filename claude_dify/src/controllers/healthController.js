const logger = require('../utils/logger');
const { execSync } = require('child_process');

const healthCheck = async (req, res) => {
  try {
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
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      cpu: {
        user: process.cpuUsage().user / 1000000,
        system: process.cpuUsage().system / 1000000
      }
    };

    // Log health check
    logger.systemHealth('api', 'healthy', {
      memory: `${healthData.memory.used}MB`,
      uptime: `${Math.round(healthData.uptime)}s`
    });

    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const debugInfo = async (req, res) => {
  try {
    // Get Playwright browser info
    let playwrightInfo = {};
    try {
      const { chromium } = require('playwright');
      playwrightInfo = {
        version: require('playwright/package.json').version,
        chromiumVersion: 'Available',
        executablePath: 'Bundled with Playwright'
      };
    } catch (error) {
      playwrightInfo = {
        error: 'Playwright not properly installed',
        message: error.message
      };
    }

    // Get system info
    let systemInfo = {};
    try {
      systemInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        hostname: require('os').hostname(),
        totalMemory: Math.round(require('os').totalmem() / 1024 / 1024) + 'MB',
        freeMemory: Math.round(require('os').freemem() / 1024 / 1024) + 'MB',
        loadAverage: require('os').loadavg()
      };
    } catch (error) {
      systemInfo = { error: error.message };
    }

    // Get GCP info
    let gcpInfo = {};
    try {
      gcpInfo = {
        projectId: process.env.GOOGLE_CLOUD_PROJECT || 'Not set',
        bucketName: process.env.GCS_BUCKET_NAME || 'Not set',
        region: process.env.GOOGLE_CLOUD_REGION || 'Not set',
        serviceAccount: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Set' : 'Not set'
      };
    } catch (error) {
      gcpInfo = { error: error.message };
    }

    // Get environment variables (sanitized)
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      DEBUG: process.env.DEBUG,
      PORT: process.env.PORT,
      npm_package_version: process.env.npm_package_version,
      // Hide sensitive values
      secretsSet: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Set' : 'Not set'
      }
    };

    const debugData = {
      success: true,
      timestamp: new Date().toISOString(),
      debug: {
        system: systemInfo,
        node: {
          version: process.version,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        playwright: playwrightInfo,
        gcp: gcpInfo,
        environment: envInfo,
        dependencies: {
          express: require('express/package.json').version,
          playwright: require('playwright/package.json').version,
          winston: require('winston/package.json').version
        }
      },
      endpoints: {
        'GET /health': 'Basic health check',
        'GET /debug': 'Detailed debug information (this endpoint)',
        'POST /analyze': 'Analyze URL with Playwright'
      },
      sampleRequest: {
        method: 'POST',
        url: '/analyze',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          url: 'https://example.com',
          viewports: [
            { name: 'mobile', width: 375, height: 667 },
            { name: 'desktop', width: 1920, height: 1080 }
          ],
          options: {
            timeout: 30000,
            waitFor: '.main-content',
            skipImages: false
          }
        }
      },
      troubleshooting: {
        commonIssues: [
          'Playwright not installed: run "npx playwright install chromium"',
          'GCS permissions: check GOOGLE_APPLICATION_CREDENTIALS',
          'Memory issues: increase Cloud Run memory to 4Gi',
          'Timeout issues: increase timeout in request options'
        ],
        logLevels: ['ERROR', 'WARN', 'INFO', 'DEBUG'],
        debugMode: 'Set DEBUG=true for verbose logging'
      }
    };

    logger.debug('🔍 Debug info requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json(debugData);
  } catch (error) {
    logger.error('Debug info failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to gather debug information',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  healthCheck,
  debugInfo
};