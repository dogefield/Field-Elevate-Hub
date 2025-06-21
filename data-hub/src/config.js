export const config = {
  port: process.env.DATA_HUB_PORT || 8001,
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380'
  },
  marketData: {
    alpaca: {
      apiKey: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      baseUrl: 'https://data.alpaca.markets/v2',
      paperUrl: 'https://paper-api.alpaca.markets'
    },
    polygon: {
      apiKey: process.env.POLYGON_API_KEY,
      baseUrl: 'https://api.polygon.io'
    }
  },
  cache: {
    marketDataTTL: 60, // seconds
    tickDataTTL: 10,
    newsDataTTL: 300
  }
};