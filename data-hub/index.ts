import express from 'express';
import { setupMCPClient, createMCPHandler } from './mcp-client';

const app = express();
app.use(express.json());

// Initialize MCP client
const mcpClient = setupMCPClient({
  appId: 'data-hub',
  appName: 'Data Hub',
  capabilities: ['market_data', 'indicators', 'data_ingestion']
});

// Connect to hub
mcpClient.connect().then(() => {
  // Expose methods to hub
  mcpClient.exposeMethod('get_market_data', async (params: any, callback: Function) => {
    try {
      const marketData = await fetchMarketData(params.assets, params.indicators);
      callback(null, marketData);
    } catch (error) {
      callback(error);
    }
  });

  mcpClient.exposeMethod('ingest_data', async (params: any, callback: Function) => {
    try {
      const result = await ingestData(params.source, params.data);
      
      // Update shared context
      await mcpClient.updateContext('market', {
        last_update: new Date(),
        assets_updated: params.data.length
      });
      
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  });

  mcpClient.exposeMethod('health', async (_params: any, callback: Function) => {
    callback(null, {
      status: 'healthy',
      uptime: process.uptime(),
      last_data_update: getLastUpdateTime()
    });
  });
});

// Handle hub requests
app.post('/api/:method', createMCPHandler(mcpClient));

// Your existing data hub logic
async function fetchMarketData(assets: string[], indicators: string[]) {
  // Implementation
  return {
    assets: {},
    indicators: {},
    timestamp: new Date()
  };
}

async function ingestData(source: string, data: any[]) {
  // Implementation
  return {
    ingested: data.length,
    errors: 0
  };
}

function getLastUpdateTime() {
  // Implementation
  return new Date();
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Data Hub running on port ${PORT}`);
});
