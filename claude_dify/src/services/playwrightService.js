const { chromium } = require('playwright');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const gcsService = require('./gcsService');
const evaluationCriteria = require('../config/evaluationCriteriaExtended');
const { v4: uuidv4 } = require('uuid');

class PlaywrightService {
  constructor() {
    this.browser = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      logger.info('🎭 Initializing Playwright browser...');
      
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ]
      });

      this.isInitialized = true;
      logger.info('✅ Playwright browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Playwright browser:', error);
      throw new AppError('Failed to initialize browser', 500, 'PLAYWRIGHT_INIT_ERROR', {
        error: error.message
      });
    }
  }

  async analyzeUrl(url, viewports = [], options = {}) {
    const analysisId = uuidv4();
    const startTime = Date.now();
    
    logger.info(`🔍 Starting analysis for ${url}`, { analysisId, url });
    
    try {
      await this.initialize();
      
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; Claude-Dify-Checker/1.0; +https://checker-api)',
        timeout: options.timeout || 30000,
        ignoreHTTPSErrors: true
      });

      const page = await context.newPage();
      
      // Set up error handling
      page.on('console', msg => {
        if (msg.type() === 'error') {
          logger.warn(`Browser console error: ${msg.text()}`);
        }
      });

      page.on('pageerror', error => {
        logger.warn(`Page error: ${error.message}`);
      });

      // Navigate to the page
      logger.playwrightAction('navigate', url);
      const navigationStartTime = Date.now();
      
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: options.timeout || 30000
      });

      if (!response) {
        throw new AppError('Failed to load page', 502, 'PAGE_LOAD_FAILED');
      }

      if (!response.ok()) {
        throw new AppError(`HTTP ${response.status()}: ${response.statusText()}`, 502, 'HTTP_ERROR', {
          status: response.status(),
          statusText: response.statusText()
        });
      }

      const navigationTime = Date.now() - navigationStartTime;
      logger.performanceMetric('page_navigation', navigationTime);

      // Wait for additional elements if specified
      if (options.waitFor) {
        try {
          await page.waitForSelector(options.waitFor, { timeout: 10000 });
          logger.playwrightAction('wait_for_selector', url, { selector: options.waitFor });
        } catch (error) {
          logger.warn(`Wait for selector failed: ${options.waitFor}`, { error: error.message });
        }
      }

      // Wait for network to be idle
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        logger.warn('Network idle timeout - continuing with analysis');
      });

      // Take screenshots for all viewports
      const screenshots = await this.takeScreenshots(page, analysisId, viewports);

      // Perform 67-point evaluation
      const analysis = await this.performEvaluation(page, navigationTime);

      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(page);

      // Close context
      await context.close();

      const totalTime = Date.now() - startTime;
      logger.performanceMetric('total_analysis', totalTime);
      logger.info(`✅ Analysis completed for ${url}`, { 
        analysisId, 
        duration: totalTime,
        score: analysis.summary.score
      });

      return {
        success: true,
        url,
        analysisId,
        timestamp: new Date().toISOString(),
        screenshots,
        analysis,
        performance: performanceMetrics,
        processingTime: totalTime
      };

    } catch (error) {
      logger.error(`Analysis failed for ${url}:`, error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      // Handle specific Playwright errors
      if (error.message.includes('timeout')) {
        throw new AppError('Page load timeout', 504, 'TIMEOUT_ERROR', {
          url,
          timeout: options.timeout || 30000
        });
      }
      
      if (error.message.includes('net::')) {
        throw new AppError('Network error', 502, 'NETWORK_ERROR', {
          url,
          networkError: error.message
        });
      }

      throw new AppError('Analysis failed', 500, 'ANALYSIS_ERROR', {
        url,
        error: error.message
      });
    }
  }

  async takeScreenshots(page, analysisId, viewports) {
    const screenshots = [];
    const defaultViewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 },
      { name: '4k', width: 3840, height: 2160 }
    ];

    const targetViewports = viewports.length > 0 ? viewports : defaultViewports;

    for (const viewport of targetViewports) {
      try {
        logger.playwrightAction('screenshot', page.url(), viewport);
        
        await page.setViewportSize({ 
          width: viewport.width, 
          height: viewport.height 
        });
        
        // Wait a bit for layout to settle
        await page.waitForTimeout(1000);

        const screenshotBuffer = await page.screenshot({
          fullPage: true,
          type: 'png',
          quality: 85
        });

        // Upload to GCS
        const filename = `screenshots/${analysisId}-${viewport.name}.png`;
        const gcsUrl = await gcsService.uploadScreenshot(screenshotBuffer, filename);

        screenshots.push({
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          gcs_url: gcsUrl,
          size_bytes: screenshotBuffer.length,
          filename
        });

        logger.debug(`📸 Screenshot taken: ${viewport.name} (${screenshotBuffer.length} bytes)`);

      } catch (error) {
        logger.error(`Screenshot failed for ${viewport.name}:`, error);
        screenshots.push({
          viewport: viewport.name,
          width: viewport.width,
          height: viewport.height,
          error: error.message,
          gcs_url: null,
          size_bytes: 0
        });
      }
    }

    return screenshots;
  }

  async performEvaluation(page, navigationTime) {
    const results = [];
    let totalItems = 0;
    let passedItems = 0;

    logger.info('🔍 Starting 67-point evaluation...');

    // Process each category
    for (const [category, criteria] of Object.entries(evaluationCriteria)) {
      logger.debug(`Evaluating ${category} (${criteria.length} items)`);
      
      for (const criterion of criteria) {
        totalItems++;
        try {
          const startTime = Date.now();
          
          let result;
          if (criterion.id === 'perf-001') {
            // Special handling for page load time
            result = await criterion.check(page, Date.now() - navigationTime);
          } else {
            result = await criterion.check(page);
          }

          const checkTime = Date.now() - startTime;
          
          const evaluationResult = {
            category,
            id: criterion.id,
            name: criterion.name,
            description: criterion.description,
            impact: criterion.impact,
            status: result.status,
            details: result.details,
            recommendations: result.recommendations || [],
            checkTime
          };

          results.push(evaluationResult);

          if (result.status === 'pass') {
            passedItems++;
          }

          // Log slow checks
          if (checkTime > 5000) {
            logger.warn(`Slow evaluation check: ${criterion.id}`, { 
              checkTime,
              status: result.status 
            });
          }

        } catch (error) {
          logger.error(`Evaluation error for ${criterion.id}:`, error);
          
          results.push({
            category,
            id: criterion.id,
            name: criterion.name,
            description: criterion.description,
            impact: criterion.impact,
            status: 'error',
            details: `Evaluation failed: ${error.message}`,
            recommendations: ['Unable to evaluate - check page accessibility'],
            checkTime: 0
          });
        }
      }
    }

    const score = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;
    
    logger.info(`📊 Evaluation completed: ${passedItems}/${totalItems} passed (${score}%)`);

    return {
      items: results,
      summary: {
        total: totalItems,
        passed: passedItems,
        failed: totalItems - passedItems,
        score,
        categories: {
          accessibility: results.filter(r => r.category === 'accessibility').length,
          performance: results.filter(r => r.category === 'performance').length,
          seo: results.filter(r => r.category === 'seo').length,
          security: results.filter(r => r.category === 'security').length,
          usability: results.filter(r => r.category === 'usability').length
        }
      }
    };
  }

  async getPerformanceMetrics(page) {
    try {
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        return {
          loadTime: navigation ? Math.round(navigation.loadEventEnd - navigation.fetchStart) : 0,
          domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart) : 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          largestContentfulPaint: paint.find(p => p.name === 'largest-contentful-paint')?.startTime || 0,
          domElements: document.querySelectorAll('*').length,
          networkRequests: performance.getEntriesByType('resource').length,
          documentSize: document.documentElement.outerHTML.length
        };
      });

      logger.performanceMetric('dom_elements', metrics.domElements, 'count');
      logger.performanceMetric('network_requests', metrics.networkRequests, 'count');

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      return {
        loadTime: 0,
        domContentLoaded: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        domElements: 0,
        networkRequests: 0,
        documentSize: 0,
        error: error.message
      };
    }
  }

  async close() {
    if (this.browser) {
      logger.info('🔒 Closing Playwright browser...');
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
    }
  }

  // Health check method
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const context = await this.browser.newContext();
      const page = await context.newPage();
      
      // Simple test navigation
      await page.goto('data:text/html,<h1>Health Check</h1>', { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      });
      
      await context.close();
      
      return { status: 'healthy', browser: 'operational' };
    } catch (error) {
      logger.error('Playwright health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

// Singleton instance
const playwrightService = new PlaywrightService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await playwrightService.close();
});

process.on('SIGINT', async () => {
  await playwrightService.close();
});

module.exports = playwrightService;