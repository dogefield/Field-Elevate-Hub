const request = require('supertest');
const { app } = require('../../server');

describe('API Endpoints', () => {
  test('GET / returns basic info', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'Field Elevate Trading Platform API');
  });

  test('GET /api/portfolio returns portfolio data', async () => {
    const res = await request(app).get('/api/portfolio');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('totalValue');
    expect(res.body).toHaveProperty('cashBalance');
  });

  test('GET /api/positions returns list', async () => {
    const res = await request(app).get('/api/positions');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('symbol');
  });

  test('GET /api/market-data returns market info', async () => {
    const res = await request(app).get('/api/market-data');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('markets');
    expect(Array.isArray(res.body.markets)).toBe(true);
  });
});
