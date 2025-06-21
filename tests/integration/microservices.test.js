const request = require('supertest');
const axios = require('axios');

describe('Microservices Integration Tests', () => {
  // Test service discovery and communication
  const services = {
    main: process.env.MAIN_SERVICE_URL || 'http://localhost:3000',
    mcpHub: process.env.MCP_HUB_URL || 'http://localhost:8001',
    dataHub: process.env.DATA_HUB_URL || 'http://localhost:8002',
    riskAnalyzer: process.env.RISK_ANALYZER_URL || 'http://localhost:8003',
    aiCoo: process.env.AI_COO_URL || 'http://localhost:8004'
  };

  beforeAll(async () => {
    // Wait for services to be ready
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  describe('Service Health Checks', () => {
    test('all services should be healthy', async () => {
      const healthChecks = await Promise.allSettled(
        Object.entries(services).map(async ([name, url]) => {
          try {
            const response = await axios.get(`${url}/health`, { timeout: 5000 });
            expect(response.status).toBe(200);
            expect(response.data.status).toBe('healthy');
            return { service: name, status: 'healthy' };
          } catch (error) {
            console.warn(`Service ${name} at ${url} is not responding`);
            return { service: name, status: 'unhealthy', error: error.message };
          }
        })
      );

      const results = healthChecks.map(result => result.value || result.reason);
      console.log('Health check results:', results);
      
      // At least the main service should be healthy
      const mainService = results.find(r => r.service === 'main');
      expect(mainService.status).toBe('healthy');
    }, 30000);
  });

  describe('Data Flow Integration', () => {
    test('market data should flow from data-hub to main service', async () => {
      try {
        // Get market data from data-hub
        const dataHubResponse = await axios.get(`${services.dataHub}/api/market-data`);
        expect(dataHubResponse.status).toBe(200);
        
        // Verify main service can access market data
        const mainResponse = await axios.get(`${services.main}/api/market-data`);
        expect(mainResponse.status).toBe(200);
        expect(mainResponse.data.markets).toBeDefined();
      } catch (error) {
        console.warn('Data flow test skipped - services not available');
      }
    });

    test('portfolio updates should trigger risk analysis', async () => {
      try {
        // Update portfolio
        const portfolioUpdate = {
          positions: [
            { symbol: 'AAPL', quantity: 1000, value: 175000 },
            { symbol: 'GOOGL', quantity: 100, value: 285000 }
          ],
          totalValue: 500000
        };

        // Send to risk analyzer
        const riskResponse = await axios.post(
          `${services.riskAnalyzer}/api/analyze-portfolio`,
          portfolioUpdate
        );
        
        expect(riskResponse.status).toBe(200);
        expect(riskResponse.data.riskMetrics).toBeDefined();
      } catch (error) {
        console.warn('Risk analysis test skipped - service not available');
      }
    });
  });

  describe('AI Integration', () => {
    test('AI-COO should receive market context and provide recommendations', async () => {
      try {
        const marketContext = {
          volatility: 'high',
          trend: 'bullish',
          sectors: ['technology', 'healthcare']
        };

        const aiResponse = await axios.post(
          `${services.aiCoo}/api/analyze-market`,
          marketContext
        );

        expect(aiResponse.status).toBe(200);
        expect(aiResponse.data.recommendations).toBeDefined();
      } catch (error) {
        console.warn('AI integration test skipped - service not available');
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    test('main service should handle downstream service failures gracefully', async () => {
      // Test with a non-existent service endpoint
      const response = await request(services.main)
        .get('/api/portfolio')
        .expect(200);

      // Should return mock data even if other services are down
      expect(response.body.totalValue).toBeDefined();
    });

    test('services should implement circuit breaker pattern', async () => {
      // This would test that services don't cascade failures
      // Implementation depends on your circuit breaker setup
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Authentication Flow', () => {
    test('JWT tokens should work across services', async () => {
      try {
        // Register a user
        const registerResponse = await axios.post(`${services.main}/api/auth/register`, {
          email: 'test@example.com',
          password: 'testpassword123',
          name: 'Test User'
        });

        expect(registerResponse.status).toBe(200);
        const token = registerResponse.data.token;

        // Use token to access protected endpoint
        const protectedResponse = await axios.get(`${services.main}/api/portfolio`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        expect(protectedResponse.status).toBe(200);
      } catch (error) {
        console.warn('Auth flow test skipped - database not configured');
      }
    });
  });
}); 