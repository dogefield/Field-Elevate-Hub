import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

interface MCPClientConfig {
  appId: string;
  appName: string;
  hubUrl: string;
  authToken: string;
  capabilities: string[];
  version: string;
}

export class MCPClient extends EventEmitter {
  private axios: AxiosInstance;
  private registered = false;
  private heartbeatInterval?: NodeJS.Timer;

  constructor(private config: MCPClientConfig) {
    super();
    
    this.axios = axios.create({
      baseURL: this.config.hubUrl,
      headers: {
        'X-MCP-Token': this.config.authToken,
        'X-App-ID': this.config.appId
      },
      timeout: 30000
    });
  }

  async connect() {
    try {
      // Register with hub
      await this.register();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Subscribe to updates
      await this.subscribeToUpdates();
      
      console.log(`[MCP] Connected to hub as ${this.config.appId}`);
    } catch (error) {
      console.error('[MCP] Connection failed:', error);
      throw error;
    }
  }

  private async register() {
    const response = await this.axios.post('/register', {
      id: this.config.appId,
      name: this.config.appName,
      url: process.env.REPL_URL || `https://${this.config.appId}.repl.co`,
      type: 'replit',
      capabilities: this.config.capabilities,
      version: this.config.version
    });

    this.registered = true;
    this.emit('registered', response.data);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.axios.post('/heartbeat', {
          appId: this.config.appId,
          status: 'online',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[MCP] Heartbeat failed:', error);
        this.emit('error', error);
      }
    }, 30000); // Every 30 seconds
  }

  private async subscribeToUpdates() {
    // In a real implementation, this would be WebSocket or SSE
    // For now, we'll poll for updates
    setInterval(async () => {
      try {
        const response = await this.axios.get(`/updates/${this.config.appId}`);
        if (response.data.updates) {
          response.data.updates.forEach((update: any) => {
            this.emit('update', update);
          });
        }
      } catch (error) {
        console.error('[MCP] Failed to fetch updates:', error);
      }
    }, 5000); // Every 5 seconds
  }

  // Expose methods to hub
  async exposeMethod(name: string, handler: Function) {
    // Register the method with the hub
    await this.axios.post('/methods/register', {
      appId: this.config.appId,
      method: name,
      schema: this.generateSchema(handler)
    });

    // Store handler locally
    this.on(`method:${name}`, handler);
  }

  // Call another app through hub
  async callApp(targetAppId: string, method: string, params: any) {
    const response = await this.axios.post('/call', {
      from: this.config.appId,
      to: targetAppId,
      method,
      params
    });

    return response.data;
  }

  // Update shared context
  async updateContext(contextType: string, data: any) {
    const response = await this.axios.post('/context/update', {
      appId: this.config.appId,
      type: contextType,
      data
    });

    return response.data;
  }

  // Get shared context
  async getContext(contextType?: string) {
    const response = await this.axios.get('/context', {
      params: { type: contextType }
    });

    return response.data;
  }

  // Stream data to hub
  async streamData(streamName: string, data: any) {
    const response = await this.axios.post('/stream', {
      appId: this.config.appId,
      stream: streamName,
      data
    });

    return response.data;
  }

  private generateSchema(handler: Function) {
    // Simple schema generation - in production, use proper reflection
    return {
      params: handler.length,
      name: handler.name
    };
  }

  async disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    await this.axios.post('/disconnect', {
      appId: this.config.appId
    });

    this.registered = false;
    this.removeAllListeners();
  }
}

// Express middleware for handling hub requests
export function createMCPHandler(client: MCPClient) {
  return async (req: any, res: any, next: any) => {
    // Verify request is from hub
    if (req.headers['x-mcp-token'] !== process.env.MCP_AUTH_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method, params } = req.body;

    try {
      // Check if we have a handler for this method
      if (client.listenerCount(`method:${method}`) === 0) {
        return res.status(404).json({ error: `Method ${method} not found` });
      }

      // Execute the method
      const result = await new Promise((resolve, reject) => {
        client.emit(`method:${method}`, params, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      res.json({ result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}

// Usage example for a Replit app
export function setupMCPClient(appConfig: Partial<MCPClientConfig>) {
  const client = new MCPClient({
    appId: process.env.APP_ID || 'unknown-app',
    appName: process.env.APP_NAME || 'Unknown App',
    hubUrl: process.env.MCP_HUB_URL || 'http://localhost:8080',
    authToken: process.env.MCP_AUTH_TOKEN || '',
    capabilities: [],
    version: '1.0.0',
    ...appConfig
  });

  // Handle connection events
  client.on('registered', () => {
    console.log('[MCP] Successfully registered with hub');
  });

  client.on('update', (update) => {
    console.log('[MCP] Received update:', update);
  });

  client.on('error', (error) => {
    console.error('[MCP] Error:', error);
  });

  return client;
}
