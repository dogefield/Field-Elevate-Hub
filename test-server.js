console.log('TEST SERVER STARTING');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

const http = require('http');
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log('Request received:', req.url);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Railway!\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Keep alive
setInterval(() => {
  console.log('Still alive:', new Date().toISOString());
}, 10000);