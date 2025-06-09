export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  source: string;
}

export interface Indicator {
  name: string;
  value: number;
  signal: 'buy' | 'sell' | 'neutral';
  confidence: number;
  timeframe: string;
}

export interface MarketSnapshot {
  assets: Record<string, AssetData>;
  overall_trend: 'bullish' | 'bearish' | 'neutral';
  volatility_index: number;
  fear_greed_index: number;
  top_movers: Mover[];
  timestamp: Date;
}

export interface AssetData {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
  indicators: Indicator[];
  support_levels: number[];
  resistance_levels: number[];
}

export interface Mover {
  symbol: string;
  change_percentage: number;
  volume_spike: number;
  reason?: string;
}
