import axios from 'axios';
import { config } from '../config.js';

export class MarketDataService {
  constructor(redis) {
    this.redis = redis;
    this.alpacaHeaders = {
      'APCA-API-KEY-ID': config.marketData.alpaca.apiKey,
      'APCA-API-SECRET-KEY': config.marketData.alpaca.secretKey
    };
  }

  async getQuote(symbol) {
    const cacheKey = `quote:${symbol}`;
    
    // Check cache first
    if (this.redis?.isReady) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Try Alpaca first
      if (config.marketData.alpaca.apiKey && config.marketData.alpaca.apiKey !== 'your_alpaca_api_key_here') {
        const response = await axios.get(
          `${config.marketData.alpaca.baseUrl}/stocks/${symbol}/quotes/latest`,
          { headers: this.alpacaHeaders }
        );
        
        const quote = {
          symbol,
          ask: response.data.quote.ap,
          bid: response.data.quote.bp,
          askSize: response.data.quote.as,
          bidSize: response.data.quote.bs,
          timestamp: response.data.quote.t,
          source: 'alpaca'
        };

        // Cache the result
        if (this.redis?.isReady) {
          await this.redis.setEx(cacheKey, config.cache.tickDataTTL, JSON.stringify(quote));
        }

        return quote;
      }
    } catch (error) {
      console.error('Error fetching quote from Alpaca:', error.message);
    }

    // Fallback to mock data for development
    const mockQuote = {
      symbol,
      ask: 100 + Math.random() * 50,
      bid: 100 + Math.random() * 49,
      askSize: Math.floor(Math.random() * 1000),
      bidSize: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      source: 'mock'
    };

    if (this.redis?.isReady) {
      await this.redis.setEx(cacheKey, config.cache.tickDataTTL, JSON.stringify(mockQuote));
    }

    return mockQuote;
  }

  async getBars(symbol, timeframe = '1Day', limit = 100) {
    const cacheKey = `bars:${symbol}:${timeframe}:${limit}`;
    
    // Check cache
    if (this.redis?.isReady) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      if (config.marketData.alpaca.apiKey && config.marketData.alpaca.apiKey !== 'your_alpaca_api_key_here') {
        const response = await axios.get(
          `${config.marketData.alpaca.baseUrl}/stocks/${symbol}/bars`,
          {
            headers: this.alpacaHeaders,
            params: {
              timeframe,
              limit,
              adjustment: 'raw'
            }
          }
        );

        const bars = response.data.bars.map(bar => ({
          timestamp: bar.t,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
          trades: bar.n,
          vwap: bar.vw
        }));

        if (this.redis?.isReady) {
          await this.redis.setEx(cacheKey, config.cache.marketDataTTL, JSON.stringify(bars));
        }

        return bars;
      }
    } catch (error) {
      console.error('Error fetching bars from Alpaca:', error.message);
    }

    // Generate mock historical data
    const mockBars = [];
    const now = Date.now();
    for (let i = 0; i < limit; i++) {
      const basePrice = 100 + Math.random() * 50;
      mockBars.push({
        timestamp: new Date(now - i * 86400000).toISOString(),
        open: basePrice + Math.random() * 5,
        high: basePrice + Math.random() * 10,
        low: basePrice - Math.random() * 5,
        close: basePrice + Math.random() * 5,
        volume: Math.floor(Math.random() * 1000000),
        trades: Math.floor(Math.random() * 1000),
        vwap: basePrice
      });
    }

    if (this.redis?.isReady) {
      await this.redis.setEx(cacheKey, config.cache.marketDataTTL, JSON.stringify(mockBars));
    }

    return mockBars;
  }

  async getSnapshot(symbols) {
    const results = {};
    
    // Fetch quotes for all symbols in parallel
    const promises = symbols.map(async (symbol) => {
      const quote = await this.getQuote(symbol);
      results[symbol] = quote;
    });

    await Promise.all(promises);
    return results;
  }

  async getTechnicals(symbol) {
    const bars = await this.getBars(symbol, '1Day', 50);
    
    if (!bars || bars.length === 0) {
      return null;
    }

    // Calculate simple technical indicators
    const closes = bars.map(bar => bar.close);
    const volumes = bars.map(bar => bar.volume);

    // Simple Moving Averages
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = closes.length >= 50 ? this.calculateSMA(closes, 50) : null;

    // RSI
    const rsi = this.calculateRSI(closes, 14);

    // Volume analysis
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeRatio = volumes[0] / avgVolume;

    return {
      symbol,
      price: closes[0],
      sma20,
      sma50,
      rsi,
      avgVolume,
      volumeRatio,
      priceChange24h: ((closes[0] - closes[1]) / closes[1]) * 100,
      timestamp: new Date().toISOString()
    };
  }

  calculateSMA(values, period) {
    if (values.length < period) return null;
    const sum = values.slice(0, period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = closes[i - 1] - closes[i];
      if (diff > 0) {
        gains += diff;
      } else {
        losses -= diff;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return Math.round(rsi * 100) / 100;
  }
}