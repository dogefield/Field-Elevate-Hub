# Field Elevate Hub - Testing Guide

## 🚀 Quick Start

### Run All Tests
```bash
npm test:all
# or
node run-all-tests.js
```

### Run Specific Test Categories
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:api          # API endpoint tests only
npm run test:security     # Security tests only
npm run test:performance  # Performance tests only
npm run test:e2e          # End-to-end tests only
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

## 📁 Test File Structure

```
Field-Elevate-Hub/
├── tests/
│   ├── unit/
│   │   └── portfolio.test.js         # Portfolio calculations
│   ├── integration/
│   │   └── microservices.test.js     # Service communication
│   ├── api/
│   │   └── server.test.js            # API endpoint tests
│   ├── security/
│   │   └── security.test.js          # Security vulnerability tests
│   ├── performance/
│   │   └── load-test.js              # Load and performance tests
│   └── e2e/
│       └── user-journey.test.js      # End-to-end user workflows
└── run-all-tests.js                  # Master test runner
```

## 🧪 Test Categories Explained

### Unit Tests
- Test individual functions and components in isolation
- Mock external dependencies
- Fast execution
- Example: Portfolio value calculations, risk metrics

### Integration Tests
- Test interactions between multiple components
- Verify service communication
- Database operations
- Example: Microservice health checks, data flow

### API Tests
- Test HTTP endpoints
- Verify request/response formats
- Status codes and error handling
- Example: Authentication endpoints, portfolio API

### Security Tests
- Test for common vulnerabilities
- Input validation
- Authentication/authorization
- Example: SQL injection prevention, XSS protection

### Performance Tests
- Load testing
- Response time verification
- Memory usage monitoring
- Example: Concurrent user handling, scalability

### End-to-End Tests
- Complete user workflows
- Real-world scenarios
- Cross-service operations
- Example: User registration to trading workflow

## 🔧 Writing New Tests

### Unit Test Example
```javascript
describe('Portfolio Calculations', () => {
  test('should calculate total value correctly', () => {
    const positions = [
      { symbol: 'AAPL', quantity: 100, currentPrice: 175.00 }
    ];
    const cashBalance = 50000;
    const expected = 67500;
    
    const result = calculatePortfolioValue(positions, cashBalance);
    expect(result).toBe(expected);
  });
});
```

### Integration Test Example
```javascript
describe('Service Communication', () => {
  test('data hub should provide market data', async () => {
    const response = await axios.get('http://localhost:8002/api/market-data');
    expect(response.status).toBe(200);
    expect(response.data.markets).toBeDefined();
  });
});
```

## 🐛 Debugging Failed Tests

1. **Check Prerequisites**
   - Is the database running?
   - Are environment variables set?
   - Are all dependencies installed?

2. **Run Individual Tests**
   ```bash
   npm test -- tests/unit/portfolio.test.js
   ```

3. **Check Logs**
   - Test output shows detailed error messages
   - Check `test-report.json` for summary

4. **Common Issues**
   - Database not configured: Set DATABASE_URL
   - Port conflicts: Ensure port 3000 is free
   - Missing dependencies: Run `npm install`

## 📊 Test Reports

After running tests, check:
- Console output for immediate results
- `test-report.json` for detailed report
- Coverage reports in `/coverage` directory

## 🔄 Continuous Integration

Add to your CI/CD pipeline:
```yaml
# Example GitHub Actions
- name: Run Tests
  run: |
    npm install
    npm run test:all
```

## 💡 Best Practices

1. **Keep Tests Fast**
   - Mock external services in unit tests
   - Use test databases for integration tests

2. **Test Isolation**
   - Each test should be independent
   - Clean up test data after each test

3. **Meaningful Names**
   - Use descriptive test names
   - Group related tests with describe blocks

4. **Coverage Goals**
   - Aim for 80%+ code coverage
   - Focus on critical business logic

5. **Regular Execution**
   - Run tests before committing
   - Set up pre-commit hooks
   - Monitor test results in CI/CD

## 🆘 Need Help?

- Check `PROJECT_STATUS_REPORT.md` for overall status
- Review existing tests for examples
- Run tests with `--verbose` flag for more details
- Check Jest documentation: https://jestjs.io/docs/

---

Remember: Good tests are the foundation of reliable software! 🏗️ 