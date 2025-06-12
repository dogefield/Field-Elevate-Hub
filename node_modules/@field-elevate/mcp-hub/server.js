import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const health = {
    status: 'healthy',
    service: 'mcp-hub',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.1.0'
  };
  
  // Check if we have database URLs configured
  if (process.env.DATABASE_URL) {
    health.postgres = 'configured';
  }
  if (process.env.REDIS_URL) {
    health.redis = 'configured';
  }
  
  return health;
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return { 
    message: 'Field Elevate MCP Hub is running!',
    version: '1.1.0',
    status: 'online',
    services: {
      postgres: process.env.DATABASE_URL ? 'ready' : 'not configured',
      redis: process.env.REDIS_URL ? 'ready' : 'not configured',
      anthropic: process.env.ANTHROPIC_API_KEY ? 'ready' : 'not configured'
    }
  };
});

// Service registry endpoint
fastify.get('/services', async (request, reply) => {
  return {
    registered_services: [],
    timestamp: new Date().toISOString()
  };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: parseInt(port), host: '0.0.0.0' });
    console.log(`MCP Hub v1.1.0 listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();