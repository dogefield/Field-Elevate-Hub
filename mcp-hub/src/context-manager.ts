import { RedisManager } from './redis-manager.js';
import { logger } from './utils/logger.js';

interface ContextLayer {
  id: string;
  type: 'system' | 'market' | 'portfolio' | 'strategy' | 'risk';
  data: any;
  timestamp: Date;
  ttl?: number;
  version: number;
}

export class ContextManager {
  private contextPrefix = 'context:';
  
  constructor(private redis: RedisManager) {}

  async updateContext(type: string, data: any, ttl?: number) {
    const contextKey = `${this.contextPrefix}${type}`;
    
    // Get current version
    const current = await this.redis.get(contextKey);
    const version = current ? current.version + 1 : 1;
    
    const context: ContextLayer = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: type as any,
      data,
      timestamp: new Date(),
      ttl,
      version
    };

    // Store in Redis
    await this.redis.set(contextKey, context, ttl);
    
    // Add to context history stream
    await this.redis.addToStream('context:history', {
      type,
      contextId: context.id,
      version,
      timestamp: context.timestamp.toISOString()
    });

    // Publish update event
    await this.redis.publish('context:updated', {
      type,
      contextId: context.id,
      version
    });

    logger.info(`Context updated: ${type} v${version}`);
  }

  async getContext(type: string): Promise<ContextLayer | null> {
    const contextKey = `${this.contextPrefix}${type}`;
    return await this.redis.get(contextKey);
  }

  async getAllContexts(): Promise<Record<string, ContextLayer>> {
    const types = ['system', 'market', 'portfolio', 'strategy', 'risk'];
    const contexts: Record<string, ContextLayer> = {};
    
    for (const type of types) {
      const context = await this.getContext(type);
      if (context) {
        contexts[type] = context;
      }
    }
    
    return contexts;
  }

  async getPortfolioState() {
    const portfolioContext = await this.getContext('portfolio');
    
    if (!portfolioContext) {
      // Return default empty portfolio
      return {
        positions: {},
        cash: 0,
        total_value: 0,
        last_updated: new Date().toISOString()
      };
    }
    
    return portfolioContext.data;
  }

  async gatherReportData(reportType: string) {
    const contexts = await this.getAllContexts();
    
    // Get recent trades
    const trades = await this.redis.readStream('trades:executed', '0', 100);
    
    // Get strategy performance
    const strategyContext = contexts.strategy?.data || {};
    
    // Get risk metrics
    const riskContext = contexts.risk?.data || {};
    
    // Compile report data based on type
    const reportData = {
      report_type: reportType,
      generated_at: new Date().toISOString(),
      portfolio: contexts.portfolio?.data || {},
      market_snapshot: contexts.market?.data || {},
      active_strategies: strategyContext.active_strategies || [],
      strategy_rankings: strategyContext.rankings || [],
      risk_metrics: riskContext,
      recent_trades: trades.map(t => ({
        id: t.id,
        ...this.parseStreamMessage(t.message)
      })),
      system_health: contexts.system?.data || {}
    };

    return reportData;
  }

  async createMemorySnapshot() {
    const contexts = await this.getAllContexts();
    
    // Create a compressed snapshot for LLM consumption
    return {
      timestamp: new Date().toISOString(),
      portfolio_summary: this.summarizePortfolio(contexts.portfolio?.data),
      market_conditions: this.summarizeMarket(contexts.market?.data),
      active_strategies: contexts.strategy?.data?.active_strategies?.length || 0,
      risk_level: contexts.risk?.data?.overall_risk_score || 'unknown',
      recent_performance: {
        daily_pnl: contexts.portfolio?.data?.daily_pnl || 0,
        weekly_pnl: contexts.portfolio?.data?.weekly_pnl || 0,
        sharpe_ratio: contexts.portfolio?.data?.sharpe_ratio || 0
      }
    };
  }

  private summarizePortfolio(portfolioData: any) {
    if (!portfolioData) return 'No portfolio data';
    
    return {
      total_value: portfolioData.total_value || 0,
      position_count: Object.keys(portfolioData.positions || {}).length,
      cash_percentage: portfolioData.cash / portfolioData.total_value * 100,
      top_positions: this.getTopPositions(portfolioData.positions)
    };
  }

  private summarizeMarket(marketData: any) {
    if (!marketData) return 'No market data';
    
    return {
      trend: marketData.overall_trend || 'neutral',
      volatility: marketData.volatility_index || 'normal',
      top_movers: marketData.top_movers || [],
      signals_detected: marketData.signal_count || 0
    };
  }

  private getTopPositions(positions: any) {
    if (!positions) return [];
    
    return Object.entries(positions)
      .map(([symbol, data]: [string, any]) => ({
        symbol,
        value: data.value,
        percentage: data.percentage
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  private parseStreamMessage(message: Record<string, string>) {
    const parsed: any = {};
    
    for (const [key, value] of Object.entries(message)) {
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        parsed[key] = value;
      }
    }
    
    return parsed;
  }
}
