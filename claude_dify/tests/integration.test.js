const request = require('supertest');
const app = require('../src/server');

describe('Integration Tests', () => {
  let server;

  beforeAll((done) => {
    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('API Endpoints', () => {
    test('POST /analyze should handle valid URL', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'https://example.com',
          viewports: [
            { name: 'desktop', width: 1920, height: 1080 }
          ],
          options: {
            timeout: 30000,
            generateReport: false // Skip report generation for tests
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('url', 'https://example.com');
      expect(response.body).toHaveProperty('screenshots');
      expect(response.body).toHaveProperty('analysis');
      expect(response.body.analysis).toHaveProperty('summary');
    }, 60000);

    test('POST /analyze should reject invalid URL', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'not-a-valid-url'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /analyze should handle missing URL', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    test('POST /analyze should handle timeout option', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'https://httpstat.us/200?sleep=5000', // Slow response
          options: {
            timeout: 3000, // 3 second timeout
            generateReport: false
          }
        })
        .expect(504);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'TIMEOUT_ERROR');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('Should handle non-existent domain', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'https://this-domain-definitely-does-not-exist-12345.com',
          options: {
            timeout: 10000,
            generateReport: false
          }
        })
        .expect(502);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'NETWORK_ERROR');
    }, 15000);

    test('Should handle malformed response', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'https://httpstat.us/500', // Returns 500 error
          options: {
            timeout: 10000,
            generateReport: false
          }
        })
        .expect(502);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('code', 'HTTP_ERROR');
    }, 15000);
  });

  describe('Performance', () => {
    test('Analysis should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'https://example.com',
          viewports: [
            { name: 'mobile', width: 375, height: 667 }
          ],
          options: {
            timeout: 30000,
            generateReport: false
          }
        })
        .expect(200);

      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(45000); // Should complete within 45 seconds
      expect(response.body).toHaveProperty('processingTime');
      expect(response.body.processingTime).toBeLessThan(45000);
    }, 60000);
  });

  describe('Security', () => {
    test('Should reject private IP addresses in production', async () => {
      // This would only apply in production environment
      if (process.env.NODE_ENV === 'production') {
        const response = await request(app)
          .post('/analyze')
          .send({
            url: 'http://192.168.1.1'
          })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('code', 'PRIVATE_IP_BLOCKED');
      }
    });

    test('Should have security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Cost Tracking', () => {
    test('Should include cost estimate in response', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({
          url: 'https://example.com',
          options: {
            generateReport: false
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('costEstimate');
      expect(response.body.costEstimate).toHaveProperty('analysis', '$0.042');
      expect(response.body.costEstimate).toHaveProperty('currency', 'USD');
    }, 45000);
  });
});