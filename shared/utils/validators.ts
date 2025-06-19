import { z } from 'zod';

// Market data validators
export const MarketDataSchema = z.object({
  symbol: z.string(),
  price: z.number().positive(),
  volume: z.number().nonnegative(),
  timestamp: z.date(),
  source: z.string()
});

// Strategy validators
export const StrategyParametersSchema = z.object({
  entry_conditions: z.array(z.object({
    indicator: z.string(),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'crosses_above', 'crosses_below']),
    value: z.union([z.number(), z.string()]),
    timeframe: z.string().optional()
  })),
  exit_conditions: z.array(z.object({
    indicator: z.string(),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte', 'crosses_above', 'crosses_below']),
    value: z.union([z.number(), z.string()]),
    timeframe: z.string().optional()
  })),
  position_sizing: z.object({
    method: z.enum(['fixed', 'kelly', 'risk_parity', 'volatility_adjusted']),
    base_size: z.number().positive(),
    max_size: z.number().positive(),
    scale_factor: z.number().optional()
  }),
  timeframe: z.string(),
  assets: z.array(z.string()),
  max_positions: z.number().positive().int(),
  stop_loss: z.number().optional(),
  take_profit: z.number().optional()
});

// Trade validators
export const TradeSchema = z.object({
  strategy_id: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().positive(),
  entry_price: z.number().positive(),
  entry_time: z.date()
});

// Risk validators
export const RiskCheckSchema = z.object({
  strategy_id: z.string(),
  allocation: z.number().positive().max(1), // Max 100% of portfolio
  current_portfolio: z.any(),
  risk_params: z.object({
    max_position_size: z.number().optional(),
    max_sector_exposure: z.number().optional(),
    max_correlation: z.number().optional()
  }).optional()
});

// Helper functions
export function validateMarketData(data: unknown) {
  return MarketDataSchema.parse(data);
}

export function validateStrategy(params: unknown) {
  return StrategyParametersSchema.parse(params);
}

export function validateTrade(trade: unknown) {
  return TradeSchema.parse(trade);
}

export function validateRiskCheck(check: unknown) {
  return RiskCheckSchema.parse(check);
}
