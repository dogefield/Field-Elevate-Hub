``javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'Field Elevate Hub is running!',
    status: 'healthy',
    timestamp: new Date()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    platform: 'Field Elevate',
    version: '1.0.0',
    services: {
      'mcp-hub': 'ready',
      'data-hub': 'ready',
      'trading': 'ready'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Field Elevate Hub running on port ${PORT}`);
});
