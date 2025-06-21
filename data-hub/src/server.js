import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from 'redis';
import { config } from './config.js';
import { MarketDataService } from './services/market-data.js';
import { NewsService } from './services/news-service.js';

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
let marketDataService;
let newsService;

// Initialize Redis connection
async function initRedis() {
  redis = createClient({
    url: config.redis.url
  });
  
  redis.on('error', (err) => console.log('Redis Client Error', err));
  
  await redis.connect();
  console.log('Connected to Redis');
  
  // Initialize services
  marketDataService = new MarketDataService(redis);
  newsService = new NewsService(redis);
}

// Health check
fastify.get('/health', async (request, reply) => {
  const health = {
    status: 'healthy',
    service: 'data-hub',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    redis: redis?.isReady ? 'connected' : 'disconnected',
    uptime: process.uptime()
  };
  
  return health;
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Field Elevate Data Hub',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      market: {
        quote: '/api/market/quote/:symbol',
        bars: '/api/market/bars/:symbol',
        snapshot: '/api/market/snapshot',
        technicals: '/api/market/technicals/:symbol'
      },
      news: {
        symbol: '/api/news/:symbol',
        sentiment: '/api/news/sentiment'
      },
      stream: {
        subscribe: '/api/stream/subscribe',
        unsubscribe: '/api/stream/unsubscribe'
      }
    }
  };
});

// Market Data Endpoints
fastify.get('/api/market/quote/:symbol', async (request, reply) => {
  const { symbol } = request.params;
  
  try {
    const quote = await marketDataService.getQuote(symbol);
    return quote;
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

fastify.get('/api/market/bars/:symbol', async (request, reply) => {
  const { symbol } = request.params;
  const { timeframe = '1Day', limit = 100 } = request.query;
  
  try {
    const bars = await marketDataService.getBars(symbol, timeframe, limit);
    return { symbol, timeframe, bars };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

fastify.post('/api/market/snapshot', async (request, reply) => {
  const { symbols } = request.body;
  
  if (!symbols || !Array.isArray(symbols)) {
    return reply.code(400).send({ error: 'symbols array required' });
  }
  
  try {
    const snapshot = await marketDataService.getSnapshot(symbols);
    return snapshot;
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

fastify.get('/api/market/technicals/:symbol', async (request, reply) => {
  const { symbol } = request.params;
  
  try {
    const technicals = await marketDataService.getTechnicals(symbol);
    return technicals;
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// News Endpoints
fastify.get('/api/news/:symbol', async (request, reply) => {
  const { symbol } = request.params;
  const { limit = 10 } = request.query;
  
  try {
    const news = await newsService.getNews(symbol, limit);
    return { symbol, articles: news };
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

fastify.get('/api/news/sentiment', async (request, reply) => {
  try {
    const sentiment = await newsService.getMarketSentiment();
    return sentiment;
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// WebSocket Support for Real-time Data
let subscribers = new Map();

fastify.post('/api/stream/subscribe', async (request, reply) => {
  const { symbols, clientId } = request.body;
  
  if (!symbols || !clientId) {
    return reply.code(400).send({ error: 'symbols and clientId required' });
  }
  
  subscribers.set(clientId, symbols);
  
  return { 
    status: 'subscribed', 
    symbols, 
    clientId,
    message: 'WebSocket implementation coming soon' 
  };
});

fastify.post('/api/stream/unsubscribe', async (request, reply) => {
  const { clientId } = request.body;
  
  if (!clientId) {
    return reply.code(400).send({ error: 'clientId required' });
  }
  
  subscribers.delete(clientId);
  
  return { status: 'unsubscribed', clientId };
});

// Metrics endpoint for Prometheus
fastify.get('/metrics', async (request, reply) => {
  return {
    data_hub_requests_total: 0, // TODO: Implement proper metrics
    data_hub_cache_hits: 0,
    data_hub_cache_misses: 0,
    data_hub_api_calls: 0
  };
});

// Start server
const start = async () => {
  try {
    // Initialize Redis
    await initRedis();
    
    const port = config.port;
    await fastify.listen({ port: parseInt(port), host: '0.0.0.0' });
    console.log(`Data Hub listening on port ${port}`);
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