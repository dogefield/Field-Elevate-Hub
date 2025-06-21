/// <reference types="node" />
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { RedisManager } from './redis-manager.js';
import { AppRegistry } from './app-registry.js';
import { ContextManager } from './context-manager.js';
import { HealthMonitor } from './health-monitor.js';
import { logger } from './utils/logger.js';

const fastify = Fastify({ 
  logger: {
    level: 'info'
  }
});

// Enable CORS
await fastify.register(cors, {
  origin: true
});

// Initialize services
const redis = new RedisManager();
const appRegistry = new AppRegistry(redis);
const contextManager = new ContextManager(redis);
const healthMonitor = new HealthMonitor(redis, appRegistry);

// Initialize connections
await redis.connect();
await appRegistry.loadRegisteredApps();
await healthMonitor.start();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const health = await healthMonitor.getSystemHealth();
  return {
    status: 'healthy',
    service: 'mcp-hub',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    redis: redis.isConnected() ? 'connected' : 'disconnected',
    services: health
  };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Field Elevate MCP Hub',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      services: '/api/services',
      registry: '/api/registry',
      context: '/api/context',
      execute: '/api/execute'
    }
  };
});

// Service registry endpoints
fastify.get('/api/services', async (request, reply) => {
  const services = appRegistry.getAllApps();
  const systemHealth = await healthMonitor.getSystemHealth();
  
  return {
    systemHealth,
    services: services.map((app) => ({
      ...app,
      health: { status: app.status }
    }))
  };
});

fastify.post('/api/services/register', async (request, reply) => {
  const { id, name, url, capabilities, type = 'external' } = request.body as any;
  
  if (!id || !name || !url) {
    return reply.code(400).send({ error: 'id, name and url required' });
  }
  
  await appRegistry.registerApp({
    id,
    name,
    url,
    type,
    capabilities: capabilities || [],
    status: 'offline',
    lastSeen: new Date(),
    version: '1.0.0'
  });
  return { status: 'registered', id, name, url };
});

// Context management
fastify.get('/api/context/:type', async (request, reply) => {
  const { type } = request.params as any;
  const context = await contextManager.getContext(type);
  
  if (!context) {
    return reply.code(404).send({ error: 'Context not found' });
  }
  
  return context;
});

fastify.post('/api/context', async (request, reply) => {
  const { type, data } = request.body as any;
  
  if (!type || !data) {
    return reply.code(400).send({ error: 'type and data required' });
  }
  
  await contextManager.updateContext(type, data);
  
  // Broadcast update
  await appRegistry.broadcastUpdate({
    type: 'context_update',
    context_type: type,
    timestamp: new Date().toISOString()
  });
  
  return { status: 'updated', type };
});

// Execute tools
fastify.post('/api/execute/:tool', async (request, reply) => {
  const { tool } = request.params as any;
  const args = request.body;
  
  try {
    let result;
    
    switch (tool) {
      case 'execute_strategy':
        result = await executeStrategy(args);
        break;
      
      case 'get_market_snapshot':
        result = await getMarketSnapshot(args);
        break;
      
      case 'rank_strategies':
        result = await rankStrategies(args);
        break;
      
      case 'generate_report':
        result = await generateReport(args);
        break;
      
      default:
        return reply.code(404).send({ error: `Unknown tool: ${tool}` });
    }
    
    return result;
  } catch (error: any) {
    logger.error(`Tool execution failed: ${tool}`, error);
    return reply.code(500).send({ error: error.message });
  }
});

// Tool implementations
async function executeStrategy(args: any) {
  // Get risk approval
  const riskCheck = await appRegistry.callApp('risk-analyzer', 'check_risk', {
    strategy_id: args.strategy_id,
    allocation: args.allocation,
    current_portfolio: await contextManager.getPortfolioState()
  });

  if (!riskCheck.approved) {
    return {
      approved: false,
      reason: riskCheck.reason,
      suggested_allocation: riskCheck.suggested_allocation
    };
  }

  // Execute through trade runner
  const execution = await appRegistry.callApp('trade-runner', 'execute', {
    strategy_id: args.strategy_id,
    allocation: riskCheck.approved_allocation || args.allocation,
    risk_params: args.risk_params
  });

  // Update context
  await contextManager.updateContext('trade_execution', execution);

  return execution;
}

async function getMarketSnapshot(args: any) {
  // For now, call the Data Hub directly
  const dataHubUrl = process.env.DATA_HUB_URL || 'http://localhost:8001';
  
  try {
    const response = await fetch(`${dataHubUrl}/api/market/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: args.assets || ['BTC', 'ETH', 'SOL'] })
    });
    
    const marketData = await response.json();
    
    return {
      marketData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get market snapshot', error);
    return { error: 'Failed to fetch market data' };
  }
}

async function rankStrategies(args: any) {
  // Mock implementation for now
  const strategies = [
    { id: 'momentum-1', name: 'Momentum Alpha', sharpe: 2.1, returns: 0.15 },
    { id: 'mean-rev-1', name: 'Mean Reversion Beta', sharpe: 1.8, returns: 0.12 },
    { id: 'arb-1', name: 'Arbitrage Gamma', sharpe: 3.2, returns: 0.08 }
  ];
  
  const filtered = strategies.filter(s => s.sharpe >= (args.min_sharpe || 1.5));
  const sorted = filtered.sort((a, b) => b.sharpe - a.sharpe);
  
  await contextManager.updateContext('strategy_rankings', sorted);
  
  return {
    rankings: sorted.slice(0, args.max_strategies || 5),
    timestamp: new Date().toISOString()
  };
}

async function generateReport(args: any) {
  const reportData = await contextManager.gatherReportData(args.report_type);
  
  return {
    type: args.report_type,
    summary: `${args.report_type} report generated`,
    data: reportData,
    timestamp: new Date().toISOString()
  };
}

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.MCP_HUB_PORT || '8000');
    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info(`MCP Hub API listening on port ${port}`);
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await fastify.close();
  await redis.disconnect();
  process.exit(0);
});

start();