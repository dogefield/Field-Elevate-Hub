import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.production' });

interface DeploymentConfig {
  services: string[];
  healthCheckRetries: number;
  healthCheckDelay: number;
  rollbackOnFailure: boolean;
}

const config: DeploymentConfig = {
  services: [
    'mcp-hub',
    'data-hub',
    'signal-forge',
    'trade-runner',
    'risk-analyzer',
    'investor-portal',
    'bot-concierge',
    'ai-coo',
    'ops-console'
  ],
  healthCheckRetries: 5,
  healthCheckDelay: 10000, // 10 seconds
  rollbackOnFailure: true
};

async function deploy() {
  console.log('🚀 Starting Field Elevate production deployment...');
  
  try {
    // Pre-deployment checks
    await runPreDeploymentChecks();
    
    // Build all services
    console.log('📦 Building services...');
    await buildServices();
    
    // Run database migrations
    console.log('🗄️ Running database migrations...');
    await runMigrations();
    
    // Deploy services in order
    console.log('🔧 Deploying services...');
    await deployServices();
    
    // Run health checks
    console.log('🏥 Running health checks...');
    await runHealthChecks();
    
    // Run integration tests
    console.log('🧪 Running integration tests...');
    await runIntegrationTests();
    
    // Update monitoring
    console.log('📊 Updating monitoring configuration...');
    await updateMonitoring();
    
    console.log('✅ Deployment completed successfully!');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    
    if (config.rollbackOnFailure) {
      console.log('🔄 Rolling back deployment...');
      await rollback();
    }
    
    process.exit(1);
  }
}

async function runPreDeploymentChecks() {
  console.log('Running pre-deployment checks...');
  
  // Check required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'COINBASE_API_KEY',
    'COINBASE_API_SECRET',
    'SENDGRID_API_KEY'
  ];
  
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Check database connection
  try {
    execSync('npm run db:check', { stdio: 'inherit' });
  } catch (error) {
    throw new Error('Database connection check failed');
  }
  
  // Check Docker daemon
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch (error) {
    throw new Error('Docker daemon is not running');
  }
}

async function buildServices() {
  for (const service of config.services) {
    console.log(`Building ${service}...`);
    
    try {
      execSync(
        `docker-compose -f deployment/docker-compose.yml build ${service}`,
        { stdio: 'inherit' }
      );
    } catch (error) {
      throw new Error(`Failed to build ${service}`);
    }
  }
}

async function runMigrations() {
  try {
    execSync(
      'docker-compose -f deployment/docker-compose.yml run --rm data-hub npm run migrate',
      { stdio: 'inherit' }
    );
  } catch (error) {
    throw new Error('Database migration failed');
  }
}

async function deployServices() {
  // Deploy infrastructure services first
  const infraServices = ['postgres', 'redis', 'mcp-hub'];
  
  console.log('Deploying infrastructure services...');
  for (const service of infraServices) {
    try {
      execSync(
        `docker-compose -f deployment/docker-compose.yml up -d ${service}`,
        { stdio: 'inherit' }
      );
    } catch (error) {
      throw new Error(`Failed to deploy ${service}`);
    }
  }
  
  // Wait for infrastructure to be ready
  await sleep(15000);
  
  // Deploy application services
  console.log('Deploying application services...');
  const appServices = config.services.filter(s => !infraServices.includes(s));
  
  for (const service of appServices) {
    try {
      execSync(
        `docker-compose -f deployment/docker-compose.yml up -d ${service}`,
        { stdio: 'inherit' }
      );
      
      // Stagger deployments
      await sleep(5000);
    } catch (error) {
      throw new Error(`Failed to deploy ${service}`);
    }
  }
}

async function runHealthChecks() {
  for (let attempt = 1; attempt <= config.healthCheckRetries; attempt++) {
    console.log(`Health check attempt ${attempt}/${config.healthCheckRetries}...`);
    
    try {
      const results = await checkAllServices();
      
      if (results.every(r => r.healthy)) {
        console.log('All services are healthy!');
        return;
      }
      
      const unhealthy = results.filter(r => !r.healthy);
      console.log(`Unhealthy services: ${unhealthy.map(r => r.service).join(', ')}`);
      
      if (attempt < config.healthCheckRetries) {
        await sleep(config.healthCheckDelay);
      }
    } catch (error) {
      console.error('Health check error:', error);
    }
  }
  
  throw new Error('Health checks failed after maximum retries');
}

async function checkAllServices(): Promise<{service: string, healthy: boolean}[]> {
  const results = [] as { service: string, healthy: boolean }[];
  
  for (const service of config.services) {
    const healthy = await checkServiceHealth(service);
    results.push({ service, healthy });
  }
  
  return results;
}

async function checkServiceHealth(service: string): Promise<boolean> {
  try {
    const output = execSync(
      `docker-compose -f deployment/docker-compose.yml exec -T ${service} curl -f http://localhost:3000/health || exit 1`,
      { encoding: 'utf8' }
    );
    
    const health = JSON.parse(output);
    return health.status === 'healthy';
  } catch (error) {
    return false;
  }
}

async function runIntegrationTests() {
  try {
    execSync('npm run test:integration -- --ci', { stdio: 'inherit' });
  } catch (error) {
    throw new Error('Integration tests failed');
  }
}

async function updateMonitoring() {
  // Update Prometheus targets
  const prometheusConfig = {
    global: {
      scrape_interval: '15s',
      evaluation_interval: '15s'
    },
    scrape_configs: [
      {
        job_name: 'field-elevate',
        static_configs: [
          {
            targets: config.services.map(s => `${s}:9090`)
          }
        ]
      }
    ]
  };
  
  fs.writeFileSync(
    'monitoring/prometheus.yml',
    JSON.stringify(prometheusConfig, null, 2)
  );
  
  // Reload Prometheus
  try {
    execSync('docker-compose -f deployment/docker-compose.yml exec -T prometheus kill -HUP 1');
  } catch (error) {
    console.warn('Failed to reload Prometheus configuration');
  }
}

async function rollback() {
  console.log('Rolling back to previous deployment...');
  
  try {
    // Stop all services
    execSync(
      'docker-compose -f deployment/docker-compose.yml down',
      { stdio: 'inherit' }
    );
    
    // Restore from backup
    execSync('npm run db:restore', { stdio: 'inherit' });
    
    // Redeploy previous version
    execSync('git checkout HEAD~1', { stdio: 'inherit' });
    execSync('npm run deploy:previous', { stdio: 'inherit' });
    
  } catch (error) {
    console.error('Rollback failed:', error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run deployment
deploy().catch(console.error);
