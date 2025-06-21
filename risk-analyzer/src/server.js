import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from 'redis';
import { config } from './config.js';
import { Portfolio } from './models/portfolio.js';
import { RiskCalculator } from './services/risk-calculator.js';
import { RiskMonitor } from './services/risk-monitor.js';

const fastify = Fastify({ 
  logger: {
    level: 'info'
  }
});

// Enable CORS
await fastify.register(cors, {
  origin: true
});

// Services
let redis;
let portfolio;
let riskCalculator;
let riskMonitor;

// Data Hub client
const dataHubClient = {
  async getMarketData(symbol) {
    try {
      const response = await fetch(`${config.dataHub.url}/api/market/bars/${symbol}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Failed to fetch market data for ${symbol}:`, error);
      return null;
    }
  }
};

// Initialize Redis connection
async function initRedis() {
  redis = createClient({
    url: config.redis.url
  });
  
  redis.on('error', (err) => console.log('Redis Client Error', err));
  
  await redis.connect();
  console.log('Connected to Redis');
}

// Initialize services
async function initServices() {
  portfolio = new Portfolio();
  riskCalculator = new RiskCalculator();
  riskMonitor = new RiskMonitor(riskCalculator, dataHubClient, redis);
  
  // Load portfolio from Redis if exists
  const savedPortfolio = await redis.get('portfolio:current');
  if (savedPortfolio) {
    const data = JSON.parse(savedPortfolio);
    portfolio.cash = data.cash || 100000; // Default $100k
    for (const pos of data.positions || []) {
      portfolio.addPosition(pos.symbol, pos.quantity, pos.avgPrice, pos.sector);
    }
  } else {
    // Initialize with default portfolio
    portfolio.cash = 100000;
  }
}

// Health check
fastify.get('/health', async (request, reply) => {
  const health = {
    status: 'healthy',
    service: 'risk-analyzer',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    redis: redis?.isReady ? 'connected' : 'disconnected',
    portfolio: {
      totalValue: portfolio?.totalValue || 0,
      positionCount: portfolio?.positions.size || 0
    }
  };
  
  return health;
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Field Elevate Risk Analyzer',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      portfolio: {
        current: '/api/portfolio',
        update: '/api/portfolio/update',
        positions: '/api/portfolio/positions'
      },
      risk: {
        check: '/api/risk/check',
        evaluate: '/api/risk/evaluate',
        report: '/api/risk/report',
        limits: '/api/risk/limits'
      },
      stress: {
        test: '/api/stress/test',
        scenarios: '/api/stress/scenarios'
      }
    }
  };
});

// Portfolio endpoints
fastify.get('/api/portfolio', async (request, reply) => {
  return portfolio.toJSON();
});

fastify.get('/api/portfolio/positions', async (request, reply) => {
  return {
    positions: portfolio.getPositions(),
    largestPositions: portfolio.getLargestPositions(),
    sectorExposure: portfolio.getSectorExposure()
  };
});

fastify.post('/api/portfolio/update', async (request, reply) => {
  const { positions, cash } = request.body;
  
  if (cash !== undefined) {
    portfolio.cash = cash;
  }
  
  if (positions) {
    // Clear existing positions
    portfolio.positions.clear();
    
    // Add new positions
    for (const pos of positions) {
      portfolio.addPosition(pos.symbol, pos.quantity, pos.avgPrice, pos.sector);
    }
  }
  
  // Save to Redis
  await redis.set('portfolio:current', JSON.stringify(portfolio.toJSON()));
  
  return { status: 'updated', portfolio: portfolio.toJSON() };
});

// Risk check endpoints
fastify.post('/api/risk/check', async (request, reply) => {
  const { strategy_id, allocation, current_portfolio } = request.body;
  
  // Use provided portfolio or current portfolio
  const checkPortfolio = current_portfolio ? 
    Object.assign(new Portfolio(), current_portfolio) : 
    portfolio;
  
  const violations = await riskMonitor.checkRiskLimits(checkPortfolio);
  
  return {
    approved: violations.length === 0,
    violations,
    reason: violations.length > 0 ? violations[0].message : null,
    suggested_allocation: allocation * 0.8 // Suggest 80% of requested if violations
  };
});

fastify.post('/api/risk/evaluate', async (request, reply) => {
  const trade = request.body;
  
  const evaluation = await riskMonitor.evaluateNewTrade(trade, portfolio);
  
  return evaluation;
});

fastify.get('/api/risk/report', async (request, reply) => {
  const report = await riskMonitor.generateRiskReport(portfolio);
  
  // Cache report in Redis
  await redis.set(
    `risk:report:${Date.now()}`,
    JSON.stringify(report),
    { EX: 86400 } // 24 hour expiry
  );
  
  return report;
});

fastify.get('/api/risk/limits', async (request, reply) => {
  return config.riskLimits;
});

// Stress test endpoints
fastify.post('/api/stress/test', async (request, reply) => {
  const { scenario } = request.body;
  
  if (!scenario) {
    return reply.code(400).send({ error: 'scenario required' });
  }
  
  const result = riskCalculator.performStressTest(portfolio, scenario);
  
  return result;
});

fastify.get('/api/stress/scenarios', async (request, reply) => {
  return {
    scenarios: config.riskLimits.stressTestScenarios,
    description: 'Available stress test scenarios'
  };
});

// Real-time risk metrics
fastify.get('/api/risk/metrics', async (request, reply) => {
  const marketData = await riskMonitor.fetchMarketDataForPortfolio(portfolio);
  const metrics = await riskCalculator.calculatePortfolioRisk(portfolio, marketData);
  
  return {
    timestamp: new Date().toISOString(),
    metrics,
    alerts: riskMonitor.alerts.filter(a => a.active)
  };
});

// Correlation analysis
fastify.get('/api/risk/correlation', async (request, reply) => {
  const { symbols } = request.query;
  
  // This would calculate correlation matrix
  // For now, return mock data
  return {
    symbols: symbols ? symbols.split(',') : portfolio.getPositions().map(p => p.symbol),
    matrix: 'Correlation calculation not yet implemented',
    lastUpdated: new Date().toISOString()
  };
});

// Start periodic risk monitoring
async function startRiskMonitoring() {
  // Update portfolio metrics every minute
  setInterval(async () => {
    try {
      const positions = portfolio.getPositions();
      for (const position of positions) {
        const marketData = await dataHubClient.getMarketData(position.symbol);
        if (marketData && marketData.bars && marketData.bars.length > 0) {
          const currentPrice = marketData.bars[0].close;
          portfolio.updatePosition(position.symbol, currentPrice);
        }
      }
      
      // Check risk limits
      const violations = await riskMonitor.checkRiskLimits(portfolio);
      if (violations.length > 0) {
        console.log('Risk violations detected:', violations);
        // Publish alerts
        await redis.publish('risk:alerts', JSON.stringify(violations));
      }
      
      // Save updated portfolio
      await redis.set('portfolio:current', JSON.stringify(portfolio.toJSON()));
    } catch (error) {
      console.error('Risk monitoring error:', error);
    }
  }, config.updateIntervals.portfolioMetrics * 1000);
}

// Start server
const start = async () => {
  try {
    await initRedis();
    await initServices();
    await startRiskMonitoring();
    
    const port = parseInt(config.port);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Risk Analyzer listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await fastify.close();
  if (redis) await redis.quit();
  process.exit(0);
});

start();