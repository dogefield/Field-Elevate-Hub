#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Field Elevate Hub - Comprehensive Test Suite');
console.log('=' * 60);

const testCategories = [
  {
    name: 'Unit Tests',
    command: 'npm',
    args: ['test', '--', '--testPathPatterns', 'tests/unit'],
    description: 'Testing individual components in isolation'
  },
  {
    name: 'Integration Tests', 
    command: 'npm',
    args: ['test', '--', '--testPathPatterns', 'tests/integration'],
    description: 'Testing component interactions'
  },
  {
    name: 'API Tests',
    command: 'npm', 
    args: ['test', '--', '--testPathPatterns', 'tests/api'],
    description: 'Testing API endpoints'
  },
  {
    name: 'Security Tests',
    command: 'npm',
    args: ['test', '--', '--testPathPatterns', 'tests/security'],
    description: 'Testing security vulnerabilities'
  },
  {
    name: 'Performance Tests',
    command: 'npm',
    args: ['test', '--', '--testPathPatterns', 'tests/performance'],
    description: 'Testing performance and load handling'
  },
  {
    name: 'End-to-End Tests',
    command: 'npm',
    args: ['test', '--', '--testPathPatterns', 'tests/e2e'],
    description: 'Testing complete user journeys'
  }
];

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkPrerequisites() {
  console.log('\n🔍 Checking Prerequisites...');
  
  // Check if package.json exists
  if (!fs.existsSync('package.json')) {
    throw new Error('package.json not found. Make sure you\'re in the Field-Elevate-Hub directory.');
  }

  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    await runCommand('npm', ['install']);
  }

  // Check if test directories exist
  const testDirs = ['tests/unit', 'tests/integration', 'tests/api', 'tests/security', 'tests/performance', 'tests/e2e'];
  
  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created test directory: ${dir}`);
    }
  }

  console.log('✅ Prerequisites check complete');
}

async function runHealthCheck() {
  console.log('\n🏥 Running Health Check...');
  
  try {
    // Start the server in background for testing
    console.log('🚀 Starting server for testing...');
    const serverProcess = spawn('npm', ['start'], {
      stdio: 'pipe',
      shell: true,
      detached: true
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if server is responding
    const axios = require('axios');
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      console.log('✅ Server health check passed');
      return serverProcess;
    } catch (error) {
      console.log('⚠️  Server health check failed, continuing with available tests');
      return null;
    }
  } catch (error) {
    console.log('⚠️  Could not start server for testing, continuing with unit tests only');
    return null;
  }
}

async function runTestCategory(category) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${category.name}`);
  console.log(`📝 ${category.description}`);
  console.log(`${'='.repeat(60)}`);

  const startTime = Date.now();
  
  try {
    await runCommand(category.command, category.args);
    const duration = Date.now() - startTime;
    console.log(`✅ ${category.name} completed in ${duration}ms`);
    return { name: category.name, status: 'passed', duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${category.name} failed in ${duration}ms`);
    console.log(`Error: ${error.message}`);
    return { name: category.name, status: 'failed', duration, error: error.message };
  }
}

async function generateTestReport(results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY REPORT');
  console.log(`${'='.repeat(60)}`);

  const totalTests = results.length;
  const passedTests = results.filter(r => r.status === 'passed').length;
  const failedTests = results.filter(r => r.status === 'failed').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Test Categories: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalDuration}ms`);

  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.status === 'passed' ? '✅' : '❌';
    console.log(`  ${status} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });

  // Generate recommendations
  console.log('\n💡 Recommendations:');
  
  if (failedTests > 0) {
    console.log('  • Review failed tests and fix underlying issues');
    console.log('  • Check server configuration and dependencies');
    console.log('  • Ensure database is properly configured');
  }
  
  if (passedTests === totalTests) {
    console.log('  • All tests passed! System is ready for deployment');
    console.log('  • Consider setting up CI/CD pipeline with these tests');
    console.log('  • Monitor performance metrics in production');
  }

  const criticalIssues = results.filter(r => 
    r.status === 'failed' && 
    (r.name.includes('Security') || r.name.includes('Performance'))
  );

  if (criticalIssues.length > 0) {
    console.log('\n⚠️  CRITICAL ISSUES DETECTED:');
    criticalIssues.forEach(issue => {
      console.log(`  • ${issue.name} failed - This should be addressed before production`);
    });
  }

  // Save report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(1),
      totalDuration: totalDuration
    },
    results: results
  };

  fs.writeFileSync('test-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n💾 Test report saved to test-report.json');
}

async function main() {
  let serverProcess = null;
  
  try {
    // Check prerequisites
    await checkPrerequisites();
    
    // Run health check and start server if possible
    serverProcess = await runHealthCheck();
    
    // Run all test categories
    const results = [];
    
    for (const category of testCategories) {
      const result = await runTestCategory(category);
      results.push(result);
      
      // Add delay between test categories
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Generate comprehensive report
    await generateTestReport(results);
    
  } catch (error) {
    console.error(`\n❌ Test execution failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Cleanup: Stop server if we started it
    if (serverProcess) {
      console.log('\n🛑 Stopping test server...');
      serverProcess.kill('SIGTERM');
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Test execution interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Test execution terminated');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error(`\n💥 Unexpected error: ${error.message}`);
  process.exit(1);
}); 