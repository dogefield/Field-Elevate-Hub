import express from 'express';
import { setupMCPClient, createMCPHandler } from '../shared/mcp/mcp-client';
import { SystemMonitor } from './utils/system-monitor';
import { AlertManager } from './utils/alert-manager';
import { AgentOrchestrator } from './utils/agent-orchestrator';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Initialize components
const systemMonitor = new SystemMonitor();
const alertManager = new AlertManager();
const agentOrchestrator = new AgentOrchestrator();

// Initialize MCP client
const mcpClient = setupMCPClient({
  appId: 'ops-console',
  appName: 'Operations Console',
  capabilities: ['monitoring', 'alerting', 'agent_management', 'system_control']
});

// Connect to hub and expose methods
mcpClient.connect().then(() => {
  // Get system status
  mcpClient.exposeMethod('get_system_status', async (_params: any, callback: Function) => {
    try {
      const status = await systemMonitor.getSystemStatus();
      
      callback(null, status);
    } catch (error) {
      callback(error);
    }
  });

  // Get app health
  mcpClient.exposeMethod('get_app_health', async (_params: any, callback: Function) => {
    try {
      const apps = [
        'data-hub',
        'signal-forge',
        'trade-runner',
        'risk-analyzer',
        'investor-portal',
        'bot-concierge',
        'ai-coo'
      ];
      
      const healthChecks = await Promise.all(
        apps.map(async (appId) => {
          try {
            const health = await mcpClient.callApp(appId, 'health');
            return {
              app_id: appId,
              status: health.status,
              uptime: health.uptime,
              details: health
            };
          } catch (error) {
            return {
              app_id: appId,
              status: 'error',
              error: error.message
            };
          }
        })
      );
      
      callback(null, {
        timestamp: new Date(),
        apps: healthChecks,
        overall_health: calculateOverallHealth(healthChecks)
      });
    } catch (error) {
      callback(error);
    }
  });

  // Get active agents
  mcpClient.exposeMethod('get_agents', async (_params: any, callback: Function) => {
    try {
      const agents = await agentOrchestrator.getActiveAgents();
      
      callback(null, {
        agent_count: agents.length,
        agents,
        resource_usage: await agentOrchestrator.getResourceUsage()
      });
    } catch (error) {
      callback(error);
    }
  });

  // Pause/resume agent
  mcpClient.exposeMethod('control_agent', async (params: any, callback: Function) => {
    try {
      const { agent_id, action } = params;
      
      let result;
      switch (action) {
        case 'pause':
          result = await agentOrchestrator.pauseAgent(agent_id);
          break;
        case 'resume':
          result = await agentOrchestrator.resumeAgent(agent_id);
          break;
        case 'restart':
          result = await agentOrchestrator.restartAgent(agent_id);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  });

  // Get alerts
  mcpClient.exposeMethod('get_alerts', async (params: any, callback: Function) => {
    try {
      const { status = 'active', severity, limit = 50 } = params;
      
      const alerts = await alertManager.getAlerts({
        status,
        severity,
        limit
      });
      
      callback(null, {
        alert_count: alerts.length,
        alerts,
        summary: alertManager.getAlertSummary()
      });
    } catch (error) {
      callback(error);
    }
  });

  // Acknowledge alert
  mcpClient.exposeMethod('acknowledge_alert', async (params: any, callback: Function) => {
    try {
      const { alert_id, acknowledged_by, notes } = params;
      
      const result = await alertManager.acknowledgeAlert(alert_id, {
        acknowledged_by,
        acknowledged_at: new Date(),
        notes
      });
      
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  });

  // Get performance metrics
  mcpClient.exposeMethod('get_metrics', async (params: any, callback: Function) => {
    try {
      const { timeframe = '1h', metrics = [] } = params;
      
      const metricsData = await systemMonitor.getMetrics({
        timeframe,
        metrics: metrics.length > 0 ? metrics : undefined
      });
      
      callback(null, metricsData);
    } catch (error) {
      callback(error);
    }
  });

  // Execute system command
  mcpClient.exposeMethod('execute_command', async (params: any, callback: Function) => {
    try {
      const { command, authorized_by } = params;
      
      // Validate authorization
      if (!authorized_by) {
        throw new Error('Authorization required for system commands');
      }
      
      let result;
      switch (command) {
        case 'emergency_stop':
          result = await executeEmergencyStop();
          break;
          
        case 'clear_cache':
          result = await clearSystemCache();
          break;
          
        case 'rotate_keys':
          result = await rotateApiKeys();
          break;
          
        case 'backup_data':
          result = await triggerBackup();
          break;
          
        default:
          throw new Error(`Unknown command: ${command}`);
      }
      
      // Log command execution
      await logSystemCommand(command, authorized_by, result);
      
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  });

  // Get system logs
  mcpClient.exposeMethod('get_logs', async (params: any, callback: Function) => {
    try {
      const { app_id, level, timeframe = '1h', limit = 100 } = params;
      
      const logs = await systemMonitor.getLogs({
        app_id,
        level,
        timeframe,
        limit
      });
      
      callback(null, {
        log_count: logs.length,
        logs,
        filters_applied: { app_id, level, timeframe }
      });
    } catch (error) {
      callback(error);
    }
  });

  // Get configuration
  mcpClient.exposeMethod('get_config', async (params: any, callback: Function) => {
    try {
      const { app_id } = params;
      
      const config = await getAppConfiguration(app_id);
      
      callback(null, {
        app_id,
        config,
        last_updated: config.last_updated || new Date()
      });
    } catch (error) {
      callback(error);
    }
  });

  // Update configuration
  mcpClient.exposeMethod('update_config', async (params: any, callback: Function) => {
    try {
      const { app_id, config, updated_by } = params;
      
      // Validate configuration
      const validation = await validateConfiguration(app_id, config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }
      
      // Apply configuration
      const result = await applyConfiguration(app_id, config);
      
      // Log change
      await logConfigChange(app_id, config, updated_by);
      
      callback(null, {
        success: true,
        app_id,
        applied_config: result.config,
        restart_required: result.restart_required
      });
    } catch (error) {
      callback(error);
    }
  });

  // Health check
  mcpClient.exposeMethod('health', async (_params: any, callback: Function) => {
    callback(null, {
      status: 'healthy',
      uptime: process.uptime(),
      monitors_active: systemMonitor.getActiveMonitorCount(),
      alerts_active: alertManager.getActiveAlertCount()
    });
  });
});

// Handle hub requests
app.post('/api/:method', createMCPHandler(mcpClient));

// Web UI routes
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// WebSocket for real-time updates
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Broadcast system updates to connected clients
const broadcastUpdate = (type: string, data: any) => {
  const message = JSON.stringify({ type, data, timestamp: new Date() });
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
};

// Subscribe to system events
mcpClient.on('connected', () => {
  // Subscribe to all system events
  const eventTypes = [
    'app:health_changed',
    'alert:created',
    'alert:resolved',
    'agent:status_changed',
    'trade:executed',
    'risk:limit_breached'
  ];
  
  eventTypes.forEach(eventType => {
    mcpClient.on(eventType, (data: any) => {
      broadcastUpdate(eventType, data);
    });
  });
});

// Monitor system health periodically
setInterval(async () => {
  const health = await systemMonitor.getSystemStatus();
  broadcastUpdate('system:health', health);
}, 5000); // Every 5 seconds

// Helper functions
function calculateOverallHealth(healthChecks: any[]): string {
  const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
  const totalCount = healthChecks.length;
  
  if (healthyCount === totalCount) return 'healthy';
  if (healthyCount >= totalCount * 0.8) return 'degraded';
  if (healthyCount >= totalCount * 0.5) return 'partial';
  return 'critical';
}

async function executeEmergencyStop() {
  // Stop all trading
  await mcpClient.callApp('trade-runner', 'emergency_stop', {
    reason: 'Manual emergency stop from ops console'
  });
  
  // Pause all agents
  const agents = await agentOrchestrator.getActiveAgents();
  await Promise.all(
    agents.map(agent => agentOrchestrator.pauseAgent(agent.id))
  );
  
  // Create critical alert
  await alertManager.createAlert({
    severity: 'critical',
    title: 'Emergency Stop Executed',
    message: 'All trading and agents have been stopped',
    source: 'ops-console'
  });
  
  return {
    success: true,
    trading_stopped: true,
    agents_paused: agents.length,
    timestamp: new Date()
  };
}

async function clearSystemCache() {
  const apps = ['data-hub', 'signal-forge', 'bot-concierge'];
  
  const results = await Promise.all(
    apps.map(async (appId) => {
      try {
        await mcpClient.callApp(appId, 'clear_cache');
        return { app_id: appId, success: true };
      } catch (error) {
        return { app_id: appId, success: false, error: error.message };
      }
    })
  );
  
  return {
    success: true,
    cleared: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    details: results
  };
}

async function rotateApiKeys() {
  // In production, this would rotate actual API keys
  return {
    success: true,
    keys_rotated: ['openai', 'coinbase', 'sendgrid'],
    next_rotation: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
  };
}

async function triggerBackup() {
  // Trigger backup across all systems
  const backupId = `backup_${Date.now()}`;
  
  await mcpClient.streamData('system:backup', {
    backup_id: backupId,
    initiated_at: new Date()
  });
  
  return {
    success: true,
    backup_id: backupId,
    status: 'initiated',
    estimated_completion: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  };
}

async function logSystemCommand(command: string, authorizedBy: string, result: any) {
  const log = {
    command,
    authorized_by: authorizedBy,
    executed_at: new Date(),
    result: result.success,
    details: result
  };
  
  await systemMonitor.logAuditEvent(log);
}

async function getAppConfiguration(appId: string) {
  // Get configuration for specific app
  try {
    return await mcpClient.callApp(appId, 'get_config');
  } catch (error) {
    return {
      error: 'Configuration not available',
      app_id: appId
    };
  }
}

async function validateConfiguration(appId: string, config: any) {
  // Validate configuration based on app requirements
  const errors = [];
  
  // Basic validation
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
  }
  
  // App-specific validation
  switch (appId) {
    case 'trade-runner':
      if (config.max_position_size && config.max_position_size > 0.05) {
        errors.push('max_position_size cannot exceed 5%');
      }
      break;
      
    case 'risk-analyzer':
      if (config.var_confidence && (config.var_confidence < 0.9 || config.var_confidence > 0.99)) {
        errors.push('var_confidence must be between 0.9 and 0.99');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

async function applyConfiguration(appId: string, config: any) {
  // Apply configuration to app
  const result = await mcpClient.callApp(appId, 'update_config', { config });
  
  return {
    config: result.applied_config || config,
    restart_required: result.restart_required || false
  };
}

async function logConfigChange(appId: string, config: any, updatedBy: string) {
  const log = {
    type: 'config_change',
    app_id: appId,
    changes: config,
    updated_by: updatedBy,
    timestamp: new Date()
  };
  
  await systemMonitor.logAuditEvent(log);
}

const PORT = process.env.PORT || 3007;
server.listen(PORT, () => {
  console.log(`Operations Console running on port ${PORT}`);
});
