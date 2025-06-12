import Fastify from 'fastify';
import { createClient } from 'redis';
import axios from 'axios';

const fastify = Fastify({ logger: true });

// Redis client
let redis;

// Initialize Redis connection
async function initRedis() {
  redis = createClient({
    url: process.env.REDIS_URL
  });
  
  redis.on('error', (err) => console.log('Redis Client Error', err));
  
  await redis.connect();
  console.log('Connected to Redis');
}

// Health check
fastify.get('/health', async (request, reply) => {
  const health = {
    status: 'healthy',
    service: 'data-hub',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    redis: redis?.isReady ? 'connected' : 'disconnected'
  };
  
  return health;
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Field Elevate Data Hub',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/api/market/:symbol',
      '/api/prices/:symbol'
    ]
  };
});

// Get market data for a symbol
fastify.get('/api/market/:symbol', async (request, reply) => {
  const { symbol } = request.params;
  
  // For now, return mock data
  // Later we'll integrate real market data APIs
  const mockData = {
    symbol: symbol.toUpperCase(),
    price: Math.random() * 1000 + 100,
    change24h: (Math.random() - 0.5) * 10,
    volume24h: Math.random() * 1000000,
    timestamp: new Date().toISOString()
  };
  
  // Cache in Redis
  if (redis?.isReady) {
    await redis.setEx(
      `market:${symbol}`,
      60, // Cache for 60 seconds
      JSON.stringify(mockData)
    );
  }
  
  return mockData;
});

// Get cached price
fastify.get('/api/prices/:symbol', async (request, reply) => {
  const { symbol } = request.params;
  
  if (redis?.isReady) {
    const cached = await redis.get(`market:${symbol}`);
    if (cached) {
      return JSON.parse(cached);
    }
  }
  
  return { error: 'No data available for ' + symbol };
});

// Start server
const start = async () => {
  try {
    // Initialize Redis
    if (process.env.REDIS_URL) {
      await initRedis();
    }
    
    const port = process.env.PORT || 3001;
    await fastify.listen({ port: parseInt(port), host: '0.0.0.0' });
    console.log(`Data Hub listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();