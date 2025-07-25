import { chromium, Browser, Page } from 'playwright';
import { AnalyzeRequest, AnalyzeResponse } from '../types';

export class PlaywrightService {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log('🎭 Initializing Playwright browser...');
    
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
        '--disable-extensions'
      ]
    });
    
    console.log('✅ Playwright browser initialized');
  }

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const startTime = Date.now();
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      viewport: request.options?.viewport || { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (compatible; PlaywrightAnalyzer/1.0)'
    });

    const page = await context.newPage();

    try {
      console.log(`🔍 Analyzing: ${request.url}`);
      
      // Navigate to page
      const navigationStart = Date.now();
      const response = await page.goto(request.url, {
        waitUntil: 'domcontentloaded',
        timeout: request.options?.timeout || 30000
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response?.status()}: Failed to load page`);
      }

      const loadTime = Date.now() - navigationStart;

      // Wait for additional selector if specified
      if (request.options?.waitFor) {
        try {
          await page.waitForSelector(request.options.waitFor, { timeout: 10000 });
        } catch (error) {
          console.warn(`Wait for selector failed: ${request.options.waitFor}`);
        }
      }

      // Get page title
      const title = await page.title();

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (request.options?.screenshot !== false) {
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: true
        });
        screenshot = screenshotBuffer.toString('base64');
      }

      // Get metrics
      const metrics = await this.getPageMetrics(page);
      
      // Get accessibility analysis
      const accessibility = await this.getAccessibilityAnalysis(page);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        url: request.url,
        timestamp: new Date().toISOString(),
        data: {
          title,
          loadTime,
          screenshot,
          metrics,
          accessibility
        },
        processingTime
      };

    } finally {
      await context.close();
    }
  }

  private async getPageMetrics(page: Page) {
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      return {
        domElements: document.querySelectorAll('*').length,
        networkRequests: performance.getEntriesByType('resource').length,
        pageSize: document.documentElement.outerHTML.length
      };
    });
  }

  private async getAccessibilityAnalysis(page: Page) {
    const issues = await page.evaluate(() => {
      const issues: Array<{
        type: string;
        message: string;
        severity: 'error' | 'warning' | 'info';
      }> = [];

      // Check for images without alt text
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
      if (imagesWithoutAlt.length > 0) {
        issues.push({
          type: 'missing-alt-text',
          message: `${imagesWithoutAlt.length} images missing alt text`,
          severity: 'error'
        });
      }

      // Check for headings structure
      const h1Count = document.querySelectorAll('h1').length;
      if (h1Count === 0) {
        issues.push({
          type: 'missing-h1',
          message: 'No H1 heading found',
          severity: 'warning'
        });
      } else if (h1Count > 1) {
        issues.push({
          type: 'multiple-h1',
          message: `Multiple H1 headings found: ${h1Count}`,
          severity: 'warning'
        });
      }

      // Check for form inputs without labels
      const inputsWithoutLabels = Array.from(document.querySelectorAll('input')).filter(input => {
        const inputEl = input as HTMLInputElement;
        const id = inputEl.id;
        return id && !document.querySelector(`label[for="${id}"]`) && !input.closest('label');
      });

      if (inputsWithoutLabels.length > 0) {
        issues.push({
          type: 'missing-form-labels',
          message: `${inputsWithoutLabels.length} form inputs missing labels`,
          severity: 'error'
        });
      }

      return issues;
    });

    // Calculate score based on issues
    const totalChecks = 3; // Number of accessibility checks performed
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const warningCount = issues.filter(issue => issue.severity === 'warning').length;
    
    const score = Math.max(0, Math.round(((totalChecks - errorCount - warningCount * 0.5) / totalChecks) * 100));

    return {
      score,
      issues
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.log('🔒 Closing Playwright browser');
      await this.browser.close();
      this.browser = null;
    }
  }

  async healthCheck(): Promise<{ status: string; browser: string }> {
    try {
      await this.initialize();
      
      if (!this.browser) {
        return { status: 'unhealthy', browser: 'not initialized' };
      }

      const context = await this.browser.newContext();
      const page = await context.newPage();
      
      await page.goto('data:text/html,<h1>Health Check</h1>', { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      });
      
      await context.close();
      
      return { status: 'healthy', browser: 'operational' };
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'unhealthy', browser: 'error' };
    }
  }
}

// Singleton instance
export const playwrightService = new PlaywrightService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  await playwrightService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  await playwrightService.close();
  process.exit(0);
});