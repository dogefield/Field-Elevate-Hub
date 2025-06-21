export const config = {
  port: process.env.RISK_ANALYZER_PORT || 8004,
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380'
  },
  dataHub: {
    url: process.env.DATA_HUB_URL || 'http://localhost:8001'
  },
  riskLimits: {
    maxPositionSize: 0.10, // 10% max per position
    maxSectorExposure: 0.30, // 30% max per sector
    maxDrawdown: 0.15, // 15% max drawdown
    maxLeverage: 2.0, // 2x max leverage
    minCashReserve: 0.05, // 5% min cash
    maxCorrelation: 0.70, // 70% max correlation between positions
    maxVolatility: 0.25, // 25% annual volatility
    varConfidence: 0.95, // 95% VaR confidence level
    stressTestScenarios: [
      { name: 'Market Crash', marketDrop: -0.20, volatilitySpike: 2.0 },
      { name: 'Flash Crash', marketDrop: -0.10, volatilitySpike: 3.0 },
      { name: 'Sector Rotation', sectorDrops: { tech: -0.15, finance: 0.10 } },
      { name: 'Liquidity Crisis', liquidityDiscount: 0.20, spreadWidening: 2.0 }
    ]
  },
  updateIntervals: {
    portfolioMetrics: 60, // seconds
    correlationMatrix: 300,
    varCalculation: 120,
    stressTest: 600
  }
};