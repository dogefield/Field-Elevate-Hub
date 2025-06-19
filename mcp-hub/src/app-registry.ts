import { RedisManager } from './redis-manager.js';
import { logger } from './utils/logger.js';
import axios from 'axios';

interface RegisteredApp {
  id: string;
  name: string;
  url: string;
  type: 'replit' | 'docker' | 'external';
  capabilities: string[];
  status: 'online' | 'offline' | 'degraded';
  lastSeen: Date;
  version: string;
}

export class AppRegistry {
  private apps: Map<string, RegisteredApp> = new Map();
  
  constructor(private redis: RedisManager) {}

  async loadRegisteredApps() {
    // Load from Redis
    const savedApps = await this.redis.get('app:registry');
    
    if (savedApps) {
      for (const app of savedApps) {
        this.apps.set(app.id, app);
      }
    }

    // Register default apps
    await this.registerDefaultApps();
  }

  private async registerDefaultApps() {
    const defaultApps: RegisteredApp[] = [
      {
        id: 'data-hub',
        name: 'Data Hub',
        url: process.env.DATA_HUB_URL || 'https://data-hub.fieldelevate.repl.co',
        type: 'replit',
        capabilities: ['market_data', 'indicators', 'data_ingestion'],
        status: 'offline',
        lastSeen: new Date(),
        version: '1.0.0'
      },
      {
        id: 'signal-forge',
        name: 'Signal Forge',
        url: process.env.SIGNAL_FORGE_URL || 'https://signal-forge.fieldelevate.repl.co',
        type: 'replit',
        capabilities: ['strategy_creation', 'backtesting', 'ranking'],
        status: 'offline',
        lastSeen: new Date(),
        version: '1.0.0'
      },
      {
        id: 'trade-runner',
        name: 'Trade Runner',
        url: process.env.TRADE_RUNNER_URL || 'https://trade-runner.fieldelevate.repl.co',
        type: 'replit',
        capabilities: ['execution', 'order_management', 'position_tracking'],
        status: 'offline',
        lastSeen: new Date(),
        version: '1.0.0'
      },
      {
        id: 'risk-analyzer',
        name: 'Risk Analyzer',
        url: process.env.RISK_ANALYZER_URL || 'https://risk-analyzer.fieldelevate.repl.co',
        type: 'replit',
        capabilities: ['risk_assessment', 'portfolio_analysis', 'limits'],
        status: 'offline',
        lastSeen: new Date(),
        version: '1.0.0'
      },
      {
        id: 'investor-portal',
        name: 'Investor Portal',
        url: process.env.INVESTOR_PORTAL_URL || 'https://investor-portal.fieldelevate.repl.co',
        type: 'replit',
        capabilities: ['reporting', 'dashboards', 'notifications'],
        status: 'offline',
        lastSeen: new Date(),
        version: '1.0.0'
      }
    ];

    for (const app of defaultApps) {
      if (!this.apps.has(app.id)) {
        this.apps.set(app.id, app);
      }
    }

    await this.saveRegistry();
  }

  async registerApp(app: RegisteredApp) {
    this.apps.set(app.id, app);
    await this.saveRegistry();
    
    // Notify other systems
    await this.redis.publish('app:registered', {
      appId: app.id,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`App registered: ${app.id}`);
  }

  async callApp(appId: string, method: string, params: any) {
    const app = this.apps.get(appId);
    
    if (!app) {
      throw new Error(`App not found: ${appId}`);
    }
    
    if (app.status === 'offline') {
      throw new Error(`App offline: ${appId}`);
    }

    try {
      const response = await axios.post(
        `${app.url}/api/${method}`,
        params,
        {
          headers: {
            'X-MCP-Token': process.env.MCP_AUTH_TOKEN,
            'X-Request-ID': this.generateRequestId()
          },
          timeout: 30000 // 30 second timeout
        }
      );

      // Log successful call
      await this.redis.addToStream('app:calls', {
        appId,
        method,
        status: 'success',
        duration: response.data.duration || 0,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error: any) {
      logger.error(`Failed to call ${appId}.${method}`, error);
      
      // Log failed call
      await this.redis.addToStream('app:calls', {
        appId,
        method,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Update app status if connection failed
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        await this.updateAppStatus(appId, 'offline');
      }

      throw error;
    }
  }

  async broadcastUpdate(update: any) {
    const promises = [];
    
    for (const [appId, app] of this.apps) {
      if (app.status === 'online') {
        promises.push(
          this.callApp(appId, 'receive_update', update)
            .catch(err => logger.error(`Failed to update ${appId}`, err))
        );
      }
    }

    await Promise.allSettled(promises);
  }

  async updateAppStatus(appId: string, status: RegisteredApp['status']) {
    const app = this.apps.get(appId);
    
    if (app) {
      app.status = status;
      app.lastSeen = new Date();
      await this.saveRegistry();
      
      // Publish status change
      await this.redis.publish('app:status_change', {
        appId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  }

  getApp(appId: string): RegisteredApp | undefined {
    return this.apps.get(appId);
  }

  getAllApps(): RegisteredApp[] {
    return Array.from(this.apps.values());
  }

  getOnlineApps(): RegisteredApp[] {
    return Array.from(this.apps.values()).filter(app => app.status === 'online');
  }

  private async saveRegistry() {
    const apps = Array.from(this.apps.values());
    await this.redis.set('app:registry', apps);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
