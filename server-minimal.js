const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 MINIMAL SERVER STARTING...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Current directory:', __dirname);
console.log('Files in directory:', fs.readdirSync(__dirname).slice(0, 10));
console.log('Public directory exists:', fs.existsSync(path.join(__dirname, 'public')));

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Simple health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'index.html not found', path: indexPath });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MINIMAL SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔗 Health check available at http://localhost:${PORT}/health`);
});

// Keep the process alive
setInterval(() => {
  console.log(`⏰ Server still running at ${new Date().toISOString()}`);
}, 30000);