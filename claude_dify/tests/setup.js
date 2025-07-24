// Jest setup file
process.env.NODE_ENV = 'test';
process.env.DEBUG = 'false';
process.env.GCS_BUCKET_NAME = 'test-bucket';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

// Suppress console logs during tests unless debugging
if (!process.env.JEST_DEBUG) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Global test timeout
jest.setTimeout(30000);

// Mock GCS service for tests
jest.mock('../src/services/gcsService', () => ({
  uploadScreenshot: jest.fn().mockResolvedValue('gs://test-bucket/test-screenshot.png'),
  uploadReport: jest.fn().mockResolvedValue('https://storage.googleapis.com/test-bucket/test-report.html'),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
}));

// Mock Playwright service for faster tests
jest.mock('../src/services/playwrightService', () => ({
  analyzeUrl: jest.fn().mockResolvedValue({
    success: true,
    url: 'https://example.com',
    analysisId: 'test-analysis-id',
    timestamp: new Date().toISOString(),
    screenshots: [{
      viewport: 'desktop',
      width: 1920,
      height: 1080,
      gcs_url: 'gs://test-bucket/test-screenshot-desktop.png',
      size_bytes: 125000
    }],
    analysis: {
      items: [],
      summary: {
        total: 67,
        passed: 45,
        failed: 22,
        score: 67
      }
    },
    performance: {
      loadTime: 2500,
      domElements: 1250,
      networkRequests: 45
    },
    processingTime: 15000
  }),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
}));