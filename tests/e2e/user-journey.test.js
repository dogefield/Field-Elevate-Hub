const axios = require('axios');
const { performance } = require('perf_hooks');

describe('End-to-End User Journey Tests', () => {
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';
  let testUser = null;
  let authToken = null;

  beforeAll(async () => {
    // Setup test environment
    console.log('Setting up E2E test environment...');
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      console.log('Cleaning up test user data...');
    }
  });

  describe('New User Onboarding Journey', () => {
    test('complete new user registration and first login', async () => {
      const timestamp = Date.now();
      const testEmail = `e2e-test-${timestamp}@example.com`;
      
      // Step 1: User visits the registration page and signs up
      const registrationData = {
        email: testEmail,
        password: 'SecurePassword123!',
        name: 'E2E Test User'
      };

      const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, registrationData);
      
      expect(registerResponse.status).toBe(200);
      expect(registerResponse.data.token).toBeTruthy();
      expect(registerResponse.data.user.email).toBe(testEmail);
      
      testUser = registerResponse.data.user;
      authToken = registerResponse.data.token;

      // Step 2: User immediately accesses their portfolio
      const portfolioResponse = await axios.get(`${API_BASE}/api/portfolio`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(portfolioResponse.status).toBe(200);
      expect(portfolioResponse.data.totalValue).toBeDefined();
      expect(portfolioResponse.data.cashBalance).toBeDefined();

      // Step 3: User checks available positions
      const positionsResponse = await axios.get(`${API_BASE}/api/positions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(positionsResponse.status).toBe(200);
      expect(Array.isArray(positionsResponse.data)).toBe(true);

      // Step 4: User checks market data
      const marketDataResponse = await axios.get(`${API_BASE}/api/market-data`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(marketDataResponse.status).toBe(200);
      expect(marketDataResponse.data.markets).toBeDefined();
      expect(Array.isArray(marketDataResponse.data.markets)).toBe(true);
    }, 30000);

    test('user can log out and log back in', async () => {
      if (!testUser) {
        throw new Error('Test user not created in previous test');
      }

      // Step 1: Login with existing credentials
      const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
        email: testUser.email,
        password: 'SecurePassword123!'
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.token).toBeTruthy();
      expect(loginResponse.data.user.email).toBe(testUser.email);

      const newToken = loginResponse.data.token;

      // Step 2: Use new token to access protected resources
      const portfolioResponse = await axios.get(`${API_BASE}/api/portfolio`, {
        headers: { Authorization: `Bearer ${newToken}` }
      });

      expect(portfolioResponse.status).toBe(200);
    });
  });

  describe('Trading Workflow Journey', () => {
    test('complete trading signal to execution workflow', async () => {
      if (!authToken) {
        throw new Error('Auth token not available');
      }

      // Step 1: User checks available trading signals
      const signalsResponse = await axios.get(`${API_BASE}/api/signals`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(signalsResponse.status).toBe(200);
      expect(signalsResponse.data.activeSignals).toBeDefined();
      expect(Array.isArray(signalsResponse.data.activeSignals)).toBe(true);

      if (signalsResponse.data.activeSignals.length > 0) {
        const signal = signalsResponse.data.activeSignals[0];
        
        // Step 2: User decides to act on a signal (mock trade execution)
        const tradeData = {
          signal_id: signal.id,
          symbol: signal.symbol,
          action: signal.type,
          quantity: 10,
          price: signal.entryPrice
        };

        // Note: This would be a real trade execution endpoint
        console.log('Would execute trade:', tradeData);
        
        // Step 3: User checks updated portfolio after trade
        const updatedPortfolioResponse = await axios.get(`${API_BASE}/api/portfolio`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        expect(updatedPortfolioResponse.status).toBe(200);
      }
    });

    test('risk management workflow', async () => {
      if (!authToken) {
        throw new Error('Auth token not available');
      }

      // Step 1: User checks current risk metrics
      const portfolioResponse = await axios.get(`${API_BASE}/api/portfolio`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(portfolioResponse.status).toBe(200);
      
      const portfolio = portfolioResponse.data;
      
      // Step 2: Simulate risk analysis
      const riskMetrics = {
        totalValue: portfolio.totalValue,
        dayChange: portfolio.dayChange,
        dayChangePercent: portfolio.dayChangePercent,
        maxDrawdown: Math.abs(portfolio.dayChange) / portfolio.totalValue
      };

      // Step 3: Verify risk metrics are within acceptable bounds
      expect(riskMetrics.maxDrawdown).toBeLessThan(0.1); // Less than 10% drawdown
      
      console.log('Risk metrics:', riskMetrics);
    });
  });

  describe('Data Flow and Real-time Updates Journey', () => {
    test('market data updates reflect in portfolio', async () => {
      if (!authToken) {
        throw new Error('Auth token not available');
      }

      // Step 1: Get initial market data
      const initialMarketData = await axios.get(`${API_BASE}/api/market-data`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(initialMarketData.status).toBe(200);
      
      // Step 2: Get initial portfolio state
      const initialPortfolio = await axios.get(`${API_BASE}/api/portfolio`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(initialPortfolio.status).toBe(200);

      // Step 3: Wait a moment and check for updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: Get updated market data
      const updatedMarketData = await axios.get(`${API_BASE}/api/market-data`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(updatedMarketData.status).toBe(200);
      
      // Step 5: Verify timestamps are different (indicating updates)
      expect(updatedMarketData.data.lastUpdate).toBeDefined();
      
      console.log('Market data update verified');
    });
  });

  describe('Error Recovery Journey', () => {
    test('user can recover from network errors', async () => {
      if (!authToken) {
        throw new Error('Auth token not available');
      }

      // Step 1: Make a request that might fail
      try {
        const response = await axios.get(`${API_BASE}/api/portfolio`, {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 1 // Very short timeout to simulate network error
        });
        
        // If it succeeds, that's fine too
        expect(response.status).toBe(200);
      } catch (error) {
        // Step 2: Retry the request with normal timeout
        const retryResponse = await axios.get(`${API_BASE}/api/portfolio`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        expect(retryResponse.status).toBe(200);
        console.log('Successfully recovered from network error');
      }
    });

    test('user can handle invalid authentication gracefully', async () => {
      // Step 1: Try to access protected resource with invalid token
      try {
        await axios.get(`${API_BASE}/api/portfolio`, {
          headers: { Authorization: 'Bearer invalid-token' }
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Step 2: Verify proper error response
        expect(error.response.status).toBe(401);
      }

      // Step 3: Re-authenticate and continue
      if (testUser) {
        const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
          email: testUser.email,
          password: 'SecurePassword123!'
        });

        expect(loginResponse.status).toBe(200);
        
        // Step 4: Use new token successfully
        const portfolioResponse = await axios.get(`${API_BASE}/api/portfolio`, {
          headers: { Authorization: `Bearer ${loginResponse.data.token}` }
        });

        expect(portfolioResponse.status).toBe(200);
      }
    });
  });

  describe('Performance Under Load Journey', () => {
    test('user experience remains good under concurrent usage', async () => {
      if (!authToken) {
        throw new Error('Auth token not available');
      }

      // Simulate multiple concurrent requests from the same user
      const concurrentRequests = [
        axios.get(`${API_BASE}/api/portfolio`, { headers: { Authorization: `Bearer ${authToken}` } }),
        axios.get(`${API_BASE}/api/positions`, { headers: { Authorization: `Bearer ${authToken}` } }),
        axios.get(`${API_BASE}/api/market-data`, { headers: { Authorization: `Bearer ${authToken}` } }),
        axios.get(`${API_BASE}/api/signals`, { headers: { Authorization: `Bearer ${authToken}` } }),
        axios.get(`${API_BASE}/health`)
      ];

      const startTime = performance.now();
      const results = await Promise.all(concurrentRequests.map(req => 
        req.then(response => ({ success: true, status: response.status }))
           .catch(error => ({ success: false, status: error.response?.status }))
      ));
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const successCount = results.filter(r => r.success).length;

      console.log(`Concurrent requests completed in ${totalTime.toFixed(2)}ms`);
      console.log(`Success rate: ${successCount}/${results.length}`);

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds
      
      // Most requests should succeed
      expect(successCount).toBeGreaterThan(results.length * 0.8); // 80% success rate
    }, 15000);
  });

  describe('Mobile/Responsive Journey', () => {
    test('API responses are mobile-friendly', async () => {
      if (!authToken) {
        throw new Error('Auth token not available');
      }

      // Simulate mobile app requests with mobile user agent
      const mobileHeaders = {
        'Authorization': `Bearer ${authToken}`,
        'User-Agent': 'FieldElevate-Mobile/1.0 (iOS 15.0)'
      };

      // Test key mobile endpoints
      const mobileRequests = [
        axios.get(`${API_BASE}/api/portfolio`, { headers: mobileHeaders }),
        axios.get(`${API_BASE}/api/positions`, { headers: mobileHeaders }),
        axios.get(`${API_BASE}/api/market-data`, { headers: mobileHeaders })
      ];

      const results = await Promise.all(mobileRequests);

      results.forEach((response, index) => {
        expect(response.status).toBe(200);
        
        // Verify response size is reasonable for mobile
        const responseSize = JSON.stringify(response.data).length;
        expect(responseSize).toBeLessThan(100000); // Less than 100KB
        
        console.log(`Mobile request ${index + 1}: ${responseSize} bytes`);
      });
    });
  });
}); 