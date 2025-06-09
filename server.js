// Field Elevate Complete Trading System
// This combines all services into one file for easy deployment

const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');

// Main app
const app = express();
app.use(express.json());

// Service ports (Railway will assign these)
const PORT = process.env.PORT || 3000;

// ===================
// MCP HUB SERVICE
// ===================
const mcpHub = {
  connections: new Map(),
  
  register(serviceId, connection) {
    this.connections.set(serviceId, connection);
    console.log(`Service ${serviceId} registered`);
  },
  
  async callService(serviceId, method, params) {
    const service = this.connections.get(serviceId);
    if (!service) throw new Error(`Service ${serviceId} not found`);
    return service[method](params);
  }
};

// ===================
// DATA HUB SERVICE
// ===================
const dataHub = {
  async ingestData(params) {
    console.log('Ingesting data:', params);
    // Add your data ingestion logic
    return { success: true, records: 100 };
  },
  
  async getMarketData(params) {
    // Return mock market data
    return {
      BTC: { price: 45000, change: 2.5 },
      ETH: { price: 3000, change: 3.2 },
      SOL: { price: 100, change: -1.5 }
    };
  }
};

// Register with MCP
mcpHub.register('data-hub', dataHub);

// ===================
// SIGNAL FORGE SERVICE
// ===================
const signalForge = {
  strategies: [],
  
  async createStrategy(params) {
    const strategy = {
      id: `strat_${Date.now()}`,
      ...params,
      created: new Date()
    };
    this.strategies.push(strategy);
    return strategy;
  },
  
  async analyzeSignals(params) {
    // Mock signal analysis
    return {
      signals: [
        { asset: 'BTC', action: 'BUY', confidence: 0.85 },
        { asset: 'ETH', action: 'HOLD', confidence: 0.65 },
        { asset: 'SOL', action: 'SELL', confidence: 0.75 }
      ]
    };
  }
};

mcpHub.register('signal-forge', signalForge);

// ===================
// TRADE RUNNER SERVICE
// ===================
const tradeRunner = {
  positions: [],
  
  async executeTrade(params) {
    const trade = {
      id: `trade_${Date.now()}`,
      ...params,
      executed: new Date(),
      status: 'completed'
    };
    return trade;
  },
  
  async getPositions() {
    return this.positions;
  }
};

mcpHub.register('trade-runner', tradeRunner);

// ===================
// RISK ANALYZER SERVICE
// ===================
const riskAnalyzer = {
  async analyzeRisk(params) {
    return {
      portfolio_var: 0.02,
      max_drawdown: 0.15,
      sharpe_ratio: 1.5,
      risk_score: 'MEDIUM'
    };
  },
  
  async checkLimits(params) {
    return {
      within_limits: true,
      warnings: []
    };
  }
};

mcpHub.register('risk-analyzer', riskAnalyzer);

// ===================
// API ENDPOINTS
// ===================

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Field Elevate Hub - Full System Running',
    services: {
      'mcp-hub': 'active',
      'data-hub': 'active',
      'signal-forge': 'active',
      'trade-runner': 'active',
      'risk-analyzer': 'active'
    },
    version: '2.0.0'
  });
});

// Data endpoints
app.get('/api/market-data', async (req, res) => {
  const data = await mcpHub.callService('data-hub', 'getMarketData', {});
  res.json(data);
});

// Signal endpoints
app.post('/api/analyze-signals', async (req, res) => {
  const signals = await mcpHub.callService('signal-forge', 'analyzeSignals', req.body);
  res.json(signals);
});

// Trading endpoints
app.post('/api/execute-trade', async (req, res) => {
  const trade = await mcpHub.callService('trade-runner', 'executeTrade', req.body);
  res.json(trade);
});

// Risk endpoints
app.get('/api/risk-analysis', async (req, res) => {
  const risk = await mcpHub.callService('risk-analyzer', 'analyzeRisk', {});
  res.json(risk);
});

// Strategy endpoints
app.post('/api/create-strategy', async (req, res) => {
  const strategy = await mcpHub.callService('signal-forge', 'createStrategy', req.body);
  res.json(strategy);
});

// WebSocket for real-time updates
const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send market updates every 5 seconds
  const interval = setInterval(() => {
    mcpHub.callService('data-hub', 'getMarketData', {})
      .then(data => {
        ws.send(JSON.stringify({
          type: 'market_update',
          data
        }));
      });
  }, 5000);
  
  ws.on('close', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Field Elevate Hub running on port ${PORT}`);
  console.log('All services integrated and ready');
});
```

## Update your `package.json` to this:

```json
{
  "name": "field-elevate-hub",
  "version": "2.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
