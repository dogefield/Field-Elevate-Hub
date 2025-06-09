import { RedisManager } from './redis-manager.js';
import { AppRegistry } from './app-registry.js';
import { logger } from './utils/logger.js';
import * as promClient from 'prom-client';

export class HealthMonitor {
  private checkInterval: NodeJS.Timer | null = null;
  private metrics: {
    appHealth: promClient.Gauge;
    apiLatency: promClient.Histogram;
    contextUpdates: promClient.Counter;
    errorRate: promClient.Counter;
  };

  constructor(
    private redis: RedisManager,
    private appRegistry: AppRegistry
  ) {
    // Initialize Prometheus metrics
    this.metrics = {
      appHealth: new promClient.Gauge({
        name: 'field_elevate_app_health',
        help: 'Health status of registered apps (1=online, 0=offline)',
        labelNames: ['app_id', 'app_name']
      }),
      apiLatency: new promClient.Histogram({
        name: 'field_elevate_api_latency',
        help: 'API call latency in ms',
        labelNames: ['app_id', 'method'],
        buckets: [10, 50, 100, 500, 1000, 5000]
      }),
      contextUpdates: new promClient.Counter({
        name: 'field_elevate_context_updates',
        help: 'Number of context updates',
        labelNames: ['context_type']
      }),
      errorRate: new promClient.Counter({
        name: 'field_elevate_errors',
        help: 'Number of errors',
        labelNames: ['app_id', 'error_type']
      })
    };

    // Register metrics
    promClient.register.registerMetric(this.metrics.appHealth);
    promClient.register.registerMetric(this.metrics.apiLatency);
    promClient.register.registerMetric(this.metrics.contextUpdates);
    promClient.register.registerMetric(this.metrics.errorRate);
  }

  async start() {
    // Initial health check
    await this.checkAllApps();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllApps().catch(err => 
        logger.error('Health check failed', err)
      );
    }, 30000); // Every 30 seconds

    // Subscribe to events for real-time monitoring
    await this.subscribeToEvents();
    
    logger.info('Health monitoring started');
  }

  async stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private async checkAllApps() {
    const apps = this.appRegistry.getAllApps();
    
    for (const app of apps) {
      try {
        const start = Date.now();
        const health = await this.checkAppHealth(app.id);
        const duration = Date.now() - start;
        
        // Update metrics
        this.metrics.appHealth.set(
          { app_id: app.id, app_name: app.name },
          health.status === 'online' ? 1 : 0
        );
        
        this.metrics.apiLatency.observe(
          { app_id: app.id, method: 'health_check' },
          duration
        );

        // Update app status
        await this.appRegistry.updateAppStatus(app.id, health.status);
        
        // Store health data
        await this.redis.addToStream('health:checks', {
          appId: app.id,
          status: health.status,
          duration,
          details: health.details,
          timestamp: new Date().toISOString()
        });

        // Alert on status change
        if (health.previousStatus && health.previousStatus !== health.status) {
          await this.alertStatusChange(app.id, health.previousStatus, health.status);
        }
        
      } catch (error) {
        logger.error(`Health check failed for ${app.id}`, error);
        this.metrics.errorRate.inc({ 
          app_id: app.id, 
          error_type: 'health_check' 
        });
      }
    }
  }

  private async checkAppHealth(appId: string) {
    try {
      const response = await this.appRegistry.callApp(appId, 'health', {});
      
      return {
        status: 'online' as const,
        details: response,
        previousStatus: this.appRegistry.getApp(appId)?.status
      };
    } catch (error: any) {
      return {
        status: 'offline' as const,
        details: { error: error.message },
        previousStatus: this.appRegistry.getApp(appId)?.status
      };
    }
  }

  private async subscribeToEvents() {
    // Monitor context updates
    await this.redis.subscribe('context:updated', (message) => {
      this.metrics.contextUpdates.inc({ 
        context_type: message.type 
      });
    });

    // Monitor app errors
    await this.redis.subscribe('app:error', (message) => {
      this.metrics.errorRate.inc({ 
        app_id: message.appId, 
        error_type: message.errorType 
      });
    });
  }

  private async alertStatusChange(appId: string, oldStatus: string, newStatus: string) {
    const alert = {
      severity: newStatus === 'offline' ? 'critical' : 'warning',
      appId,
      message: `App ${appId} status changed from ${oldStatus} to ${newStatus}`,
      timestamp: new Date().toISOString()
    };

    // Store alert
    await this.redis.addToStream('alerts:system', alert);
    
    // Publish for real-time handling
    await this.redis.publish('alert:status_change', alert);
    
    logger.warn(`Status change alert: ${alert.message}`);
  }

  getMetrics() {
    return promClient.register.metrics();
  }

  async getSystemHealth() {
    const apps = this.appRegistry.getAllApps();
    const onlineCount = apps.filter(a => a.status === 'online').length;
    
    return {
      status: onlineCount === apps.length ? 'healthy' : 
              onlineCount > apps.length / 2 ? 'degraded' : 'critical',
      apps_total: apps.length,
      apps_online: onlineCount,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}
