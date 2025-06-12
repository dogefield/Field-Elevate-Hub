import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'healthy', 
    service: 'mcp-hub',
    timestamp: new Date().toISOString()
  };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return { 
    message: 'Field Elevate MCP Hub is running!',
    version: '1.0.0'
  };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: parseInt(port), host: '0.0.0.0' });
    console.log(`MCP Hub listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();