import Fastify from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'redis';
import axios from 'axios';

const fastify = Fastify({ logger: true });

// Initialize Anthropic Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Redis client
let redis;

// Initialize Redis
async function initRedis() {
  if (process.env.REDIS_URL) {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on('error', (err) => console.log('Redis Error', err));
    await redis.connect();
    console.log('AI COO connected to Redis');
  }
}

// Health check
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'ai-coo',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    claude: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured',
    redis: redis?.isReady ? 'connected' : 'disconnected'
  };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Field Elevate AI Chief Operating Officer',
    version: '1.0.0',
    model: 'claude-4-opus-20250514',
    capabilities: [
      'strategy-analysis',
      'risk-assessment', 
      'trade-decisions',
      'market-insights'
    ]
  };
});

// Analyze market conditions
fastify.post('/api/analyze-market', async (request, reply) => {
  try {
    const { symbols = ['BTC', 'ETH'] } = request.body || {};
    
    // Get market data from Data Hub
    const marketData = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const response = await axios.get(
            `${process.env.DATA_HUB_URL || 'http://localhost:3001'}/api/market/${symbol}`
          );
          return response.data;
        } catch (error) {
          return { symbol, error: 'Failed to fetch data' };
        }
      })
    );
    
    // Ask Claude to analyze the market
    const message = await anthropic.messages.create({
      model: 'claude-3-opus-20240229', // Using Claude 3 until 4 is available
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `As the AI COO of a hedge fund, analyze this market data and provide insights:
        
Market Data: ${JSON.stringify(marketData, null, 2)}

Provide:
1. Market sentiment analysis
2. Risk assessment
3. Trading opportunities
4. Recommended position sizes`
      }]
    });
    
    const analysis = {
      timestamp: new Date().toISOString(),
      symbols: symbols,
      market_data: marketData,
      ai_analysis: message.content[0].text,
      model_used: 'claude-3-opus'
    };
    
    // Cache the analysis
    if (redis?.isReady) {
      await redis.setEx(
        'analysis:latest',
        300, // 5 minutes
        JSON.stringify(analysis)
      );
    }
    
    return analysis;
    
  } catch (error) {
    fastify.log.error(error);
    return { 
      error: 'Analysis failed', 
      message: error.message 
    };
  }
});

// Get latest analysis
fastify.get('/api/latest-analysis', async (request, reply) => {
  if (redis?.isReady) {
    const cached = await redis.get('analysis:latest');
    if (cached) {
      return JSON.parse(cached);
    }
  }
  
  return { message: 'No analysis available. Run POST /api/analyze-market first.' };
});

// Start server
const start = async () => {
  try {
    await initRedis();
    
    const port = process.env.PORT || 3002;
    await fastify.listen({ port: parseInt(port), host: '0.0.0.0' });
    console.log(`AI COO listening on port ${port}`);
    console.log(`Claude model: ${process.env.ANTHROPIC_MODEL || 'claude-3-opus'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();