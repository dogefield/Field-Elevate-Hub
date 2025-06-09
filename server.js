const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Service registry
const services = {
  'data-hub': {
    getMarketData: () => ({
      BTC: { price: 45000, change: 2.5 },
      ETH: { price: 3000, change: 3.2 },
      SOL: { price: 100, change: -1.5 }
    })
  },
  'signal-forge': {
    analyzeSignals: () => ({
      signals: [
        { asset: 'BTC', action: 'BUY', confidence: 0.85 },
        { asset: 'ETH', action: 'HOLD', confidence: 0.65 },
        { asset: 'SOL', action: 'SELL', confidence: 0.75 }
      ]
    })
  },
  'risk-analyzer': {
    analyzeRisk: () => ({
      portfolio_var: 0.02,
      max_drawdown: 0.15,
      sharpe_ratio: 1.5,
      risk_score: 'MEDIUM'
    })
  }
};

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Field Elevate Hub Running',
    services: Object.keys(services),
    version: '2.0.0',
    status: 'healthy'
  });
});

// Market data endpoint
app.get('/api/market-data', (req, res) => {
  res.json(services['data-hub'].getMarketData());
});

// Trading signals endpoint
app.get('/api/signals', (req, res) => {
  res.json(services['signal-forge'].analyzeSignals());
});

// Risk analysis endpoint
app.get('/api/risk', (req, res) => {
  res.json(services['risk-analyzer'].analyzeRisk());
});

// Create strategy endpoint
app.post('/api/strategy', (req, res) => {
  res.json({
    id: `strategy_${Date.now()}`,
    name: req.body.name || 'New Strategy',
    created: new Date(),
    status: 'active'
  });
});

// Execute trade endpoint
app.post('/api/trade', (req, res) => {
  res.json({
    id: `trade_${Date.now()}`,
    asset: req.body.asset,
    action: req.body.action,
    amount: req.body.amount,
    status: 'executed',
    timestamp: new Date()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Field Elevate Hub running on port ${PORT}`);
});