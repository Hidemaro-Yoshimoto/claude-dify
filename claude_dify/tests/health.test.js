const request = require('supertest');
const app = require('../src/server');

describe('Health Endpoints', () => {
  afterAll(() => {
    // Close any open connections
    if (app.close) app.close();
  });

  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
  });

  test('GET /debug should return debug information', async () => {
    const response = await request(app)
      .get('/debug')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('debug');
    expect(response.body.debug).toHaveProperty('system');
    expect(response.body.debug).toHaveProperty('node');
    expect(response.body.debug).toHaveProperty('playwright');
  });

  test('GET /nonexistent should return 404', async () => {
    const response = await request(app)
      .get('/nonexistent')
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error', 'Route not found');
    expect(response.body).toHaveProperty('availableEndpoints');
  });
});