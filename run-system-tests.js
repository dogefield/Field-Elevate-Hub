const fetch = require('node-fetch');
const fs = require('fs').promises;

const services = [
  { name: 'MCP Hub', url: 'http://localhost:8000', healthEndpoint: '/health' },
  { name: 'Data Hub', url: 'http://localhost:8001', healthEndpoint: '/health' },
  { name: 'AI COO', url: 'http://localhost:8002', healthEndpoint: '/health' },
  { name: 'Risk Analyzer', url: 'http://localhost:8004', healthEndpoint: '/health' }
];

const testResults = {
  timestamp: new Date().toISOString(),
  services: {},
  integrationTests: {},
  summary: { passed: 0, failed: 0, total: 0 }
};

// Test service health
async function testServiceHealth(service) {
  console.log(`\nTesting ${service.name}...`);
  const results = { status: 'unknown', tests: {} };
  
  try {
    // Health check
    const healthResponse = await fetch(`${service.url}${service.healthEndpoint}`);
    const healthData = await healthResponse.json();
    results.tests.health = {
      passed: healthResponse.ok,
      status: healthResponse.status,
      data: healthData
    };
    results.status = healthResponse.ok ? 'online' : 'offline';
    
    // Service-specific tests
    if (service.name === 'Data Hub') {
      // Test market data endpoint
      const quoteResponse = await fetch(`${service.url}/api/market/quote/AAPL`);
      const quoteData = await quoteResponse.json();
      results.tests.marketQuote = {
        passed: quoteResponse.ok && quoteData.symbol === 'AAPL',
        data: quoteData
      };
      
      // Test news endpoint
      const newsResponse = await fetch(`${service.url}/api/news/AAPL`);
      const newsData = await newsResponse.json();
      results.tests.newsData = {
        passed: newsResponse.ok && newsData.articles,
        data: newsData
      };
    }
    
    if (service.name === 'Risk Analyzer') {
      // Test portfolio endpoint
      const portfolioResponse = await fetch(`${service.url}/api/portfolio`);
      const portfolioData = await portfolioResponse.json();
      results.tests.portfolio = {
        passed: portfolioResponse.ok,
        data: portfolioData
      };
      
      // Test risk limits
      const limitsResponse = await fetch(`${service.url}/api/risk/limits`);
      const limitsData = await limitsResponse.json();
      results.tests.riskLimits = {
        passed: limitsResponse.ok && limitsData.maxPositionSize !== undefined,
        data: limitsData
      };
    }
    
    if (service.name === 'AI COO') {
      // Test insights endpoint
      const insightsResponse = await fetch(`${service.url}/api/insights`);
      const insightsData = await insightsResponse.json();
      results.tests.insights = {
        passed: insightsResponse.ok,
        data: insightsData
      };
    }
    
    if (service.name === 'MCP Hub') {
      // Test services list
      const servicesResponse = await fetch(`${service.url}/api/services`);
      const servicesData = await servicesResponse.json();
      results.tests.serviceRegistry = {
        passed: servicesResponse.ok,
        data: servicesData
      };
    }
    
  } catch (error) {
    results.status = 'error';
    results.error = error.message;
  }
  
  return results;
}

// Integration tests
async function runIntegrationTests() {
  console.log('\n\nRunning Integration Tests...');
  const tests = {};
  
  // Test 1: Data flow from Data Hub to Risk Analyzer
  try {
    console.log('\nTest 1: Data Hub -> Risk Analyzer Integration');
    const marketData = await fetch('http://localhost:8001/api/market/quote/AAPL').then(r => r.json());
    const riskEval = await fetch('http://localhost:8004/api/risk/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'AAPL',
        action: 'BUY',
        quantity: 10,
        price: marketData.ask || 150
      })
    }).then(r => r.json());
    
    tests.dataToRisk = {
      passed: riskEval.approved !== undefined,
      data: { marketData, riskEval }
    };
  } catch (error) {
    tests.dataToRisk = { passed: false, error: error.message };
  }
  
  // Test 2: AI Analysis
  try {
    console.log('\nTest 2: AI COO Market Analysis');
    const analysis = await fetch('http://localhost:8002/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: ['AAPL', 'GOOGL'] })
    }).then(r => r.json());
    
    tests.aiAnalysis = {
      passed: analysis.trends || analysis.opportunities,
      data: analysis
    };
  } catch (error) {
    tests.aiAnalysis = { passed: false, error: error.message };
  }
  
  // Test 3: Cross-service communication
  try {
    console.log('\nTest 3: Cross-Service Communication');
    const contextUpdate = await fetch('http://localhost:8000/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'test',
        data: { message: 'Integration test', timestamp: new Date() }
      })
    });
    
    tests.crossService = {
      passed: contextUpdate.ok,
      status: contextUpdate.status
    };
  } catch (error) {
    tests.crossService = { passed: false, error: error.message };
  }
  
  return tests;
}

// Generate HTML report
function generateHTMLReport(results) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Field Elevate - System Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .summary {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        .summary-item {
            text-align: center;
        }
        .summary-value {
            font-size: 2.5rem;
            font-weight: bold;
        }
        .passed { color: #22c55e; }
        .failed { color: #ef4444; }
        .test-section {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
        }
        .test-grid {
            display: grid;
            gap: 15px;
            margin-top: 15px;
        }
        .test-item {
            padding: 15px;
            background: #0a0a0a;
            border-radius: 8px;
            border-left: 4px solid #333;
        }
        .test-item.passed { border-left-color: #22c55e; }
        .test-item.failed { border-left-color: #ef4444; }
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
        }
        .status-badge.passed { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .status-badge.failed { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .test-details {
            font-size: 0.9rem;
            color: #888;
            margin-top: 8px;
        }
        pre {
            background: #0a0a0a;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin-top: 10px;
            font-size: 0.85rem;
        }
        .timestamp {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 30px;
        }
        .action-buttons {
            display: flex;
            gap: 15px;
            margin-top: 30px;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-secondary {
            background: #2a2a2a;
            color: #ddd;
            border: 1px solid #444;
        }
        .btn-secondary:hover { background: #333; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Field Elevate System Test Report</h1>
        <p class="timestamp">Generated: ${results.timestamp}</p>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-value">${results.summary.total}</div>
                <div>Total Tests</div>
            </div>
            <div class="summary-item">
                <div class="summary-value passed">${results.summary.passed}</div>
                <div>Passed</div>
            </div>
            <div class="summary-item">
                <div class="summary-value failed">${results.summary.failed}</div>
                <div>Failed</div>
            </div>
        </div>
        
        <div class="test-section">
            <h2>Service Health Tests</h2>
            <div class="test-grid">
                ${Object.entries(results.services).map(([name, data]) => `
                    <div class="test-item ${data.status === 'online' ? 'passed' : 'failed'}">
                        <div class="test-header">
                            <h3>${name}</h3>
                            <span class="status-badge ${data.status === 'online' ? 'passed' : 'failed'}">
                                ${data.status}
                            </span>
                        </div>
                        ${Object.entries(data.tests || {}).map(([testName, test]) => `
                            <div class="test-details">
                                <strong>${testName}:</strong> 
                                <span class="${test.passed ? 'passed' : 'failed'}">
                                    ${test.passed ? '✓ Passed' : '✗ Failed'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="test-section">
            <h2>Integration Tests</h2>
            <div class="test-grid">
                ${Object.entries(results.integrationTests).map(([name, test]) => `
                    <div class="test-item ${test.passed ? 'passed' : 'failed'}">
                        <div class="test-header">
                            <h3>${name.replace(/([A-Z])/g, ' $1').trim()}</h3>
                            <span class="status-badge ${test.passed ? 'passed' : 'failed'}">
                                ${test.passed ? 'Passed' : 'Failed'}
                            </span>
                        </div>
                        ${test.error ? `<div class="test-details">Error: ${test.error}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="action-buttons">
            <a href="service-status.html" class="btn btn-primary">View Live Status</a>
            <a href="http://localhost:3000" class="btn btn-secondary">Open Grafana</a>
            <button class="btn btn-secondary" onclick="window.location.reload()">Refresh Tests</button>
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

// Main test runner
async function runAllTests() {
  console.log('Starting Field Elevate System Tests...\n');
  
  // Test each service
  for (const service of services) {
    const results = await testServiceHealth(service);
    testResults.services[service.name] = results;
    
    // Count passed/failed
    Object.values(results.tests || {}).forEach(test => {
      testResults.summary.total++;
      if (test.passed) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    });
  }
  
  // Run integration tests
  testResults.integrationTests = await runIntegrationTests();
  
  // Count integration test results
  Object.values(testResults.integrationTests).forEach(test => {
    testResults.summary.total++;
    if (test.passed) {
      testResults.summary.passed++;
    } else {
      testResults.summary.failed++;
    }
  });
  
  // Generate report
  const htmlReport = generateHTMLReport(testResults);
  await fs.writeFile('test-report.html', htmlReport);
  
  // Save JSON results
  await fs.writeFile('test-results.json', JSON.stringify(testResults, null, 2));
  
  console.log('\n\n========================================');
  console.log('Test Summary:');
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`Passed: ${testResults.summary.passed}`);
  console.log(`Failed: ${testResults.summary.failed}`);
  console.log('========================================');
  console.log('\nTest report saved to: test-report.html');
  console.log('Open the file in your browser to view the full report.');
  
  return testResults;
}

// Run tests
runAllTests().catch(console.error);