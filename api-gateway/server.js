import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Service endpoints
const services = {
  mcp: process.env.MCP_HUB_URL || 'http://localhost:8000',
  data: process.env.DATA_HUB_URL || 'http://localhost:8001',
  ai: process.env.AI_COO_URL || 'http://localhost:8002',
  risk: process.env.RISK_ANALYZER_URL || 'http://localhost:8004'
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services
  });
});

// Proxy routes to services
app.use('/api/mcp', createProxyMiddleware({
  target: services.mcp,
  changeOrigin: true,
  pathRewrite: { '^/api/mcp': '' }
}));

app.use('/api/data', createProxyMiddleware({
  target: services.data,
  changeOrigin: true,
  pathRewrite: { '^/api/data': '/api' }
}));

app.use('/api/ai', createProxyMiddleware({
  target: services.ai,
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '/api' }
}));

app.use('/api/risk', createProxyMiddleware({
  target: services.risk,
  changeOrigin: true,
  pathRewrite: { '^/api/risk': '/api' }
}));

// Aggregate endpoints for frontend
app.get('/api/dashboard', async (req, res) => {
  try {
    const [portfolio, marketData, riskMetrics] = await Promise.all([
      fetch(`${services.risk}/api/portfolio`).then(r => r.json()),
      fetch(`${services.data}/api/market/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: ['SPY', 'QQQ', 'BTC', 'ETH'] })
      }).then(r => r.json()),
      fetch(`${services.risk}/api/risk/metrics`).then(r => r.json())
    ]);

    res.json({
      portfolio,
      marketData,
      riskMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    // Get AI analysis
    const analysis = await fetch(`${services.ai}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).then(r => r.json());

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/execute-trade', async (req, res) => {
  try {
    // First check with risk analyzer
    const riskCheck = await fetch(`${services.risk}/api/risk/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).then(r => r.json());

    if (!riskCheck.approved) {
      return res.json({
        success: false,
        reason: riskCheck.reason,
        suggestions: riskCheck.suggestions
      });
    }

    // Get AI decision
    const decision = await fetch(`${services.ai}/api/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opportunity: req.body,
        context: { riskCheck }
      })
    }).then(r => r.json());

    res.json({
      success: decision.action === 'APPROVE',
      decision,
      riskCheck
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Service status endpoint
app.get('/api/status', async (req, res) => {
  const statuses = {};
  
  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        const data = await response.json();
        statuses[name] = { status: 'online', ...data };
      } else {
        statuses[name] = { status: 'offline', error: `HTTP ${response.status}` };
      }
    } catch (error) {
      statuses[name] = { status: 'offline', error: error.message };
    }
  }

  res.json({
    services: statuses,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
  console.log('Proxying to services:', services);
});