const axios = require('axios');
const { performance } = require('perf_hooks');

describe('Load and Performance Tests', () => {
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';
  
  describe('API Performance', () => {
    test('health endpoint should respond quickly under load', async () => {
      const concurrentRequests = 50;
      const requests = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          axios.get(`${API_BASE}/health`, { timeout: 5000 })
            .then(response => ({
              status: response.status,
              responseTime: performance.now() - startTime
            }))
            .catch(error => ({
              error: error.message,
              responseTime: performance.now() - startTime
            }))
        );
      }
      
      const results = await Promise.all(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`Load test completed in ${totalTime.toFixed(2)}ms`);
      console.log(`Average response time: ${(totalTime / concurrentRequests).toFixed(2)}ms`);
      
      // Check that most requests succeeded
      const successfulRequests = results.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(concurrentRequests * 0.8); // 80% success rate
      
      // Check average response time is reasonable
      expect(totalTime / concurrentRequests).toBeLessThan(1000); // Less than 1 second average
    }, 30000);

    test('portfolio endpoint should handle concurrent requests', async () => {
      const concurrentUsers = 20;
      const requestsPerUser = 5;
      const totalRequests = concurrentUsers * requestsPerUser;
      
      const userRequests = [];
      
      for (let user = 0; user < concurrentUsers; user++) {
        for (let req = 0; req < requestsPerUser; req++) {
          userRequests.push(
            axios.get(`${API_BASE}/api/portfolio`)
              .then(response => ({ success: true, status: response.status }))
              .catch(error => ({ success: false, error: error.message }))
          );
        }
      }
      
      const startTime = performance.now();
      const results = await Promise.all(userRequests);
      const endTime = performance.now();
      
      const successCount = results.filter(r => r.success).length;
      const successRate = (successCount / totalRequests) * 100;
      
      console.log(`Concurrent test: ${successCount}/${totalRequests} requests succeeded`);
      console.log(`Success rate: ${successRate.toFixed(1)}%`);
      console.log(`Total time: ${(endTime - startTime).toFixed(2)}ms`);
      
      expect(successRate).toBeGreaterThan(90); // 90% success rate
    }, 60000);
  });

  describe('Memory and Resource Usage', () => {
    test('should not have memory leaks during repeated requests', async () => {
      const iterations = 100;
      const memoryUsage = [];
      
      for (let i = 0; i < iterations; i++) {
        await axios.get(`${API_BASE}/api/market-data`).catch(() => {});
        
        if (i % 10 === 0) {
          // Record memory usage every 10 iterations
          const used = process.memoryUsage();
          memoryUsage.push({
            iteration: i,
            heapUsed: used.heapUsed / 1024 / 1024, // Convert to MB
            heapTotal: used.heapTotal / 1024 / 1024
          });
        }
      }
      
      console.log('Memory usage over time:', memoryUsage);
      
      // Memory usage shouldn't grow significantly
      const firstMeasurement = memoryUsage[0];
      const lastMeasurement = memoryUsage[memoryUsage.length - 1];
      const memoryGrowth = lastMeasurement.heapUsed - firstMeasurement.heapUsed;
      
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
    }, 120000);
  });

  describe('Database Performance', () => {
    test('should handle concurrent database operations', async () => {
      const concurrentOperations = 10;
      const operations = [];
      
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          axios.post(`${API_BASE}/api/auth/register`, {
            email: `loadtest${i}@example.com`,
            password: 'testpassword123',
            name: `Load Test User ${i}`
          })
          .then(response => ({ success: true, userId: response.data.user?.id }))
          .catch(error => ({ 
            success: false, 
            error: error.response?.data?.error || error.message 
          }))
        );
      }
      
      const results = await Promise.all(operations);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`Database operations: ${successCount}/${concurrentOperations} succeeded`);
      
      // Some operations might fail due to duplicate emails, but system should remain stable
      expect(successCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling Under Load', () => {
    test('should gracefully handle invalid requests under load', async () => {
      const invalidRequests = 30;
      const requests = [];
      
      for (let i = 0; i < invalidRequests; i++) {
        requests.push(
          axios.post(`${API_BASE}/api/nonexistent-endpoint`, { data: 'invalid' })
            .then(() => ({ type: 'unexpected_success' }))
            .catch(error => ({ 
              type: 'expected_error',
              status: error.response?.status,
              handled: error.response?.status === 404
            }))
        );
      }
      
      const results = await Promise.all(requests);
      const handledErrors = results.filter(r => r.handled).length;
      
      console.log(`Error handling: ${handledErrors}/${invalidRequests} errors properly handled`);
      
      // All errors should be properly handled
      expect(handledErrors).toBe(invalidRequests);
    }, 30000);
  });

  describe('Scalability Tests', () => {
    test('response time should scale reasonably with load', async () => {
      const loadLevels = [1, 5, 10, 20];
      const results = [];
      
      for (const load of loadLevels) {
        const requests = [];
        const startTime = performance.now();
        
        for (let i = 0; i < load; i++) {
          requests.push(axios.get(`${API_BASE}/api/positions`));
        }
        
        await Promise.all(requests.map(r => r.catch(() => {})));
        const endTime = performance.now();
        
        const avgResponseTime = (endTime - startTime) / load;
        results.push({ load, avgResponseTime });
        
        console.log(`Load ${load}: ${avgResponseTime.toFixed(2)}ms average response time`);
      }
      
      // Response time shouldn't increase exponentially
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      const scalingFactor = lastResult.avgResponseTime / firstResult.avgResponseTime;
      
      console.log(`Scaling factor: ${scalingFactor.toFixed(2)}x`);
      expect(scalingFactor).toBeLessThan(10); // Response time shouldn't increase more than 10x
    }, 120000);
  });
}); 