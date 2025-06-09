import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RedisManager } from '../src/redis-manager';
import { ContextManager } from '../src/context-manager';
import { AppRegistry } from '../src/app-registry';

describe('MCP Hub Tests', () => {
  let redis: RedisManager;
  let contextManager: ContextManager;
  let appRegistry: AppRegistry;

  beforeAll(async () => {
    redis = new RedisManager();
    await redis.connect();
    contextManager = new ContextManager(redis);
    appRegistry = new AppRegistry(redis);
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  describe('Context Manager', () => {
    it('should update and retrieve context', async () => {
      const testData = {
        btc_price: 45000,
        eth_price: 3000,
        timestamp: new Date()
      };

      await contextManager.updateContext('market', testData);
      const retrieved = await contextManager.getContext('market');

      expect(retrieved).toBeDefined();
      expect(retrieved?.data).toEqual(testData);
      expect(retrieved?.version).toBe(1);
    });

    it('should increment version on updates', async () => {
      await contextManager.updateContext('test', { value: 1 });
      const v1 = await contextManager.getContext('test');
      
      await contextManager.updateContext('test', { value: 2 });
      const v2 = await contextManager.getContext('test');

      expect(v2?.version).toBe(v1!.version + 1);
    });

    it('should gather report data correctly', async () => {
      // Set up test data
      await contextManager.updateContext('portfolio', {
        positions: { BTC: { value: 100000 } },
        cash: 50000,
        total_value: 150000
      });

      await contextManager.updateContext('strategy', {
        active_strategies: ['momentum_1', 'mean_reversion_1'],
        rankings: []
      });

      const reportData = await contextManager.gatherReportData('daily');

      expect(reportData.report_type).toBe('daily');
      expect(reportData.portfolio.total_value).toBe(150000);
      expect(reportData.active_strategies).toHaveLength(2);
    });
  });

  describe('App Registry', () => {
    it('should register and retrieve apps', async () => {
      const testApp = {
        id: 'test-app',
        name: 'Test App',
        url: 'http://localhost:3000',
        type: 'replit' as const,
        capabilities: ['test'],
        status: 'online' as const,
        lastSeen: new Date(),
        version: '1.0.0'
      };

      await appRegistry.registerApp(testApp);
      const retrieved = appRegistry.getApp('test-app');

      expect(retrieved).toEqual(testApp);
    });

    it('should filter online apps', async () => {
      const apps = appRegistry.getOnlineApps();
      const onlineCount = apps.filter(a => a.status === 'online').length;
      
      expect(apps).toHaveLength(onlineCount);
    });
  });

  describe('Redis Streams', () => {
    it('should add and read from streams', async () => {
      const testData = {
        event: 'test',
        value: 123,
        timestamp: new Date().toISOString()
      };

      await redis.addToStream('test:stream', testData);
      const messages = await redis.readStream('test:stream');

      expect(messages).toHaveLength(1);
      expect(messages[0].message['event']).toBe('"test"');
    });
  });
});
