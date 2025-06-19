import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { RedisManager } from './redis-manager.js';
import { AppRegistry } from './app-registry.js';
import { ContextManager } from './context-manager.js';
import { HealthMonitor } from './health-monitor.js';
import { logger } from './utils/logger.js';

class FieldElevateMCPHub {
  private server: Server;
  private redis: RedisManager;
  private appRegistry: AppRegistry;
  private contextManager: ContextManager;
  private healthMonitor: HealthMonitor;

  constructor() {
    this.server = new Server(
      {
        name: 'field-elevate-hub',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.redis = new RedisManager();
    this.appRegistry = new AppRegistry(this.redis);
    this.contextManager = new ContextManager(this.redis);
    this.healthMonitor = new HealthMonitor(this.redis, this.appRegistry);
  }

  async initialize() {
    await this.redis.connect();
    await this.appRegistry.loadRegisteredApps();
    await this.setupHandlers();
    await this.healthMonitor.start();
    
    logger.info('Field Elevate MCP Hub initialized');
  }

  private async setupHandlers() {
    // List available tools from all connected apps
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_strategy',
          description: 'Execute a trading strategy with risk checks',
          inputSchema: {
            type: 'object',
            properties: {
              strategy_id: { type: 'string' },
              allocation: { type: 'number' },
              risk_params: { type: 'object' }
            },
            required: ['strategy_id', 'allocation']
          }
        },
        {
          name: 'get_market_snapshot',
          description: 'Get current market data and indicators',
          inputSchema: {
            type: 'object',
            properties: {
              assets: { type: 'array', items: { type: 'string' } },
              indicators: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        {
          name: 'rank_strategies',
          description: 'Rank all strategies by performance metrics',
          inputSchema: {
            type: 'object',
            properties: {
              timeframe: { type: 'string', enum: ['1d', '7d', '30d'] },
              min_sharpe: { type: 'number' },
              max_strategies: { type: 'number' }
            }
          }
        },
        {
          name: 'update_context',
          description: 'Update shared context for all agents',
          inputSchema: {
            type: 'object',
            properties: {
              context_type: { type: 'string' },
              data: { type: 'object' }
            },
            required: ['context_type', 'data']
          }
        },
        {
          name: 'generate_report',
          description: 'Generate trading report',
          inputSchema: {
            type: 'object',
            properties: {
              report_type: { type: 'string', enum: ['daily', 'weekly', 'custom'] },
              include_sections: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'execute_strategy':
            return await this.executeStrategy(args);
          
          case 'get_market_snapshot':
            return await this.getMarketSnapshot(args);
          
          case 'rank_strategies':
            return await this.rankStrategies(args);
          
          case 'update_context':
            return await this.updateContext(args);
          
          case 'generate_report':
            return await this.generateReport(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        logger.error(`Tool execution failed: ${name}`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  private async executeStrategy(args: any) {
    // First, get risk approval
    const riskCheck = await this.appRegistry.callApp('risk-analyzer', 'check_risk', {
      strategy_id: args.strategy_id,
      allocation: args.allocation,
      current_portfolio: await this.contextManager.getPortfolioState()
    });

    if (!riskCheck.approved) {
      return {
        content: [{
          type: 'text',
          text: `Risk check failed: ${riskCheck.reason}. Suggested allocation: ${riskCheck.suggested_allocation}`
        }]
      };
    }

    // Execute through trade runner
    const execution = await this.appRegistry.callApp('trade-runner', 'execute', {
      strategy_id: args.strategy_id,
      allocation: riskCheck.approved_allocation || args.allocation,
      risk_params: args.risk_params
    });

    // Update context
    await this.contextManager.updateContext('trade_execution', execution);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(execution, null, 2)
      }]
    };
  }

  private async getMarketSnapshot(args: any) {
    const marketData = await this.appRegistry.callApp('data-hub', 'get_market_data', {
      assets: args.assets || ['BTC', 'ETH', 'SOL'],
      indicators: args.indicators || ['RSI', 'MACD', 'volume']
    });

    const analysis = await this.appRegistry.callApp('signal-forge', 'analyze_market', marketData);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ marketData, analysis }, null, 2)
      }]
    };
  }

  private async rankStrategies(args: any) {
    const strategies = await this.appRegistry.callApp('signal-forge', 'get_strategies', {
      active_only: true
    });

    const rankings = await this.appRegistry.callApp('signal-forge', 'rank_strategies', {
      strategies,
      timeframe: args.timeframe || '7d',
      min_sharpe: args.min_sharpe || 1.5
    });

    // Store in context for other agents
    await this.contextManager.updateContext('strategy_rankings', rankings);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(rankings.slice(0, args.max_strategies || 5), null, 2)
      }]
    };
  }

  private async updateContext(args: any) {
    await this.contextManager.updateContext(args.context_type, args.data);
    
    // Broadcast to all connected apps
    await this.appRegistry.broadcastUpdate({
      type: 'context_update',
      context_type: args.context_type,
      timestamp: new Date().toISOString()
    });

    return {
      content: [{
        type: 'text',
        text: `Context updated: ${args.context_type}`
      }]
    };
  }

  private async generateReport(args: any) {
    const reportData = await this.contextManager.gatherReportData(args.report_type);
    
    const report = await this.appRegistry.callApp('investor-portal', 'generate_report', {
      type: args.report_type,
      data: reportData,
      sections: args.include_sections
    });

    return {
      content: [{
        type: 'text',
        text: report.summary
      }, {
        type: 'resource',
        resource: {
          uri: report.url,
          mimeType: 'application/pdf',
          text: report.full_text
        }
      }]
    };
  }

  async start() {
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('MCP Hub server started');
  }
}

// Start the server
const hub = new FieldElevateMCPHub();
hub.start().catch((error) => {
  logger.error('Failed to start MCP Hub', error);
  process.exit(1);
});
