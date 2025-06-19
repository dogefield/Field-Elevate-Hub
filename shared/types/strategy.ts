export interface Strategy {
  id: string;
  name: string;
  type: 'momentum' | 'mean_reversion' | 'arbitrage' | 'ml_based' | 'hybrid';
  status: 'active' | 'paused' | 'testing' | 'retired';
  created_at: Date;
  updated_at: Date;
  parameters: StrategyParameters;
  performance: StrategyPerformance;
  risk_metrics: RiskMetrics;
}

export interface StrategyParameters {
  entry_conditions: Condition[];
  exit_conditions: Condition[];
  position_sizing: PositionSizing;
  timeframe: string;
  assets: string[];
  max_positions: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface Condition {
  indicator: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'crosses_above' | 'crosses_below';
  value: number | string;
  timeframe?: string;
}

export interface PositionSizing {
  method: 'fixed' | 'kelly' | 'risk_parity' | 'volatility_adjusted';
  base_size: number;
  max_size: number;
  scale_factor?: number;
}

export interface StrategyPerformance {
  total_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  best_trade: Trade;
  worst_trade: Trade;
  current_drawdown: number;
  recovery_time_days: number;
}

export interface RiskMetrics {
  var_95: number;
  cvar_95: number;
  beta: number;
  correlation_to_market: number;
  volatility: number;
  downside_deviation: number;
  omega_ratio: number;
  calmar_ratio: number;
}

export interface Trade {
  id: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  entry_time: Date;
  exit_time?: Date;
  pnl?: number;
  pnl_percentage?: number;
  fees: number;
  slippage: number;
  status: 'open' | 'closed' | 'cancelled';
  exit_reason?: 'stop_loss' | 'take_profit' | 'signal' | 'manual' | 'risk_limit';
}

export interface StrategyRanking {
  strategy_id: string;
  rank: number;
  score: number;
  components: {
    performance_score: number;
    risk_score: number;
    consistency_score: number;
    recent_performance_score: number;
  };
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'exit';
  allocation_suggestion: number;
  confidence: number;
}
