const Joi = require('joi');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const playwrightService = require('../services/playwrightService');
const reportService = require('../services/reportService');

// Request validation schema
const analyzeSchema = Joi.object({
  url: Joi.string().uri().required(),
  viewports: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      width: Joi.number().integer().min(100).max(4000).required(),
      height: Joi.number().integer().min(100).max(4000).required()
    })
  ).optional(),
  options: Joi.object({
    timeout: Joi.number().integer().min(5000).max(120000).optional(),
    waitFor: Joi.string().optional(),
    skipImages: Joi.boolean().optional(),
    generateReport: Joi.boolean().optional().default(true)
  }).optional()
});

const analyzeUrl = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // Validate request
    const { error, value } = analyzeSchema.validate(req.body);
    if (error) {
      logger.warn('Invalid request data:', { 
        error: error.details.map(d => d.message),
        body: req.body 
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        timestamp: new Date().toISOString()
      });
    }

    const { url, viewports = [], options = {} } = value;
    
    logger.info(`🚀 Analysis request received`, {
      url,
      viewportsCount: viewports.length,
      options,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Security check - basic URL validation
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new AppError('Only HTTP and HTTPS URLs are supported', 400, 'INVALID_PROTOCOL');
      }
      
      // Block localhost and private IPs in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = urlObj.hostname.toLowerCase();
        if (hostname === 'localhost' || 
            hostname.startsWith('127.') || 
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          throw new AppError('Private IP addresses are not allowed', 400, 'PRIVATE_IP_BLOCKED');
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid URL format', 400, 'INVALID_URL');
    }

    // Track cost for monitoring
    logger.costTracking('analysis_start', 0.042); // Estimated cost per analysis

    // Perform analysis with Playwright
    const analysisResult = await playwrightService.analyzeUrl(url, viewports, options);

    // Generate HTML report if requested
    let reportUrl = null;
    if (options.generateReport !== false) {
      try {
        reportUrl = await reportService.generateReport(analysisResult);
        logger.info(`📄 Report generated: ${reportUrl}`);
      } catch (reportError) {
        logger.warn('Report generation failed:', reportError);
        // Don't fail the entire request if report generation fails
      }
    }

    const processingTime = Date.now() - startTime;
    logger.performanceMetric('total_request_time', processingTime);

    // Prepare successful response
    const response = {
      success: true,
      url: analysisResult.url,
      analysisId: analysisResult.analysisId,
      timestamp: analysisResult.timestamp,
      screenshots: analysisResult.screenshots.map(screenshot => ({
        viewport: screenshot.viewport,
        width: screenshot.width,
        height: screenshot.height,
        url: screenshot.gcs_url,
        sizeBytes: screenshot.size_bytes,
        error: screenshot.error || null
      })),
      analysis: {
        summary: analysisResult.analysis.summary,
        categories: {
          accessibility: analysisResult.analysis.items.filter(item => item.category === 'accessibility'),
          performance: analysisResult.analysis.items.filter(item => item.category === 'performance'),
          seo: analysisResult.analysis.items.filter(item => item.category === 'seo'),
          security: analysisResult.analysis.items.filter(item => item.category === 'security'),
          usability: analysisResult.analysis.items.filter(item => item.category === 'usability')
        }
      },
      performance: analysisResult.performance,
      processingTime,
      reportUrl,
      costEstimate: {
        analysis: '$0.042',
        currency: 'USD',
        breakdown: {
          cloudRun: '$0.0108',
          geminiLLM: '$0.0188',
          gptMini: '$0.0120',
          storage: '$0.0001',
          other: '$0.0003'
        }
      }
    };

    // Log successful analysis
    logger.info(`✅ Analysis completed successfully`, {
      url,
      analysisId: analysisResult.analysisId,
      score: analysisResult.analysis.summary.score,
      processingTime,
      screenshotCount: analysisResult.screenshots.length,
      reportGenerated: !!reportUrl
    });

    res.status(200).json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Analysis request failed:', {
      error: error.message,
      url: req.body?.url,
      processingTime,
      stack: error.stack
    });

    // Log cost even for failed requests
    logger.costTracking('analysis_failed', 0.01); // Reduced cost for failed requests

    next(error);
  }
};

// Batch analysis endpoint (for CSV processing)
const analyzeBatch = async (req, res, next) => {
  try {
    const { urls, viewports = [], options = {} } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required',
        code: 'MISSING_URLS'
      });
    }

    if (urls.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 URLs allowed per batch',
        code: 'TOO_MANY_URLS'
      });
    }

    logger.info(`📊 Batch analysis request: ${urls.length} URLs`);

    const batchId = require('uuid').v4();
    const results = [];
    const errors = [];

    // Process URLs in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks = [];
    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      chunks.push(urls.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (url, index) => {
        try {
          const result = await playwrightService.analyzeUrl(url, viewports, options);
          results.push({
            url,
            success: true,
            data: result
          });
          logger.info(`✅ Batch item completed: ${url} (${results.length}/${urls.length})`);
        } catch (error) {
          logger.error(`❌ Batch item failed: ${url}`, error);
          errors.push({
            url,
            error: error.message,
            code: error.code || 'ANALYSIS_ERROR'
          });
        }
      });

      await Promise.all(chunkPromises);
    }

    const response = {
      success: true,
      batchId,
      timestamp: new Date().toISOString(),
      summary: {
        total: urls.length,
        successful: results.length,
        failed: errors.length,
        successRate: Math.round((results.length / urls.length) * 100)
      },
      results: results.map(r => ({
        url: r.url,
        success: r.success,
        score: r.data.analysis.summary.score,
        analysisId: r.data.analysisId,
        processingTime: r.data.processingTime
      })),
      errors,
      estimatedCost: `$${(urls.length * 0.042).toFixed(3)}`
    };

    logger.info(`📊 Batch analysis completed`, {
      batchId,
      total: urls.length,
      successful: results.length,
      failed: errors.length
    });

    res.status(200).json(response);

  } catch (error) {
    logger.error('Batch analysis failed:', error);
    next(error);
  }
};

// Get analysis status (for long-running operations)
const getAnalysisStatus = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    
    if (!analysisId) {
      return res.status(400).json({
        success: false,
        error: 'Analysis ID is required',
        code: 'MISSING_ANALYSIS_ID'
      });
    }

    // In a real implementation, this would check a database or cache
    // For now, return a simple status
    res.status(200).json({
      success: true,
      analysisId,
      status: 'completed', // completed, processing, failed
      timestamp: new Date().toISOString(),
      message: 'Analysis status endpoint - implement database lookup for production'
    });

  } catch (error) {
    logger.error('Status check failed:', error);
    next(error);
  }
};

module.exports = {
  analyzeUrl,
  analyzeBatch,
  getAnalysisStatus
};