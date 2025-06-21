import { config } from '../config.js';

export class RiskMonitor {
  constructor(riskCalculator, dataHub, redis) {
    this.riskCalculator = riskCalculator;
    this.dataHub = dataHub;
    this.redis = redis;
    this.alerts = [];
    this.riskMetrics = {};
  }

  async checkRiskLimits(portfolio) {
    const violations = [];
    
    // Check position size limits
    for (const position of portfolio.getPositions()) {
      if (position.weight > config.riskLimits.maxPositionSize) {
        violations.push({
          type: 'POSITION_SIZE',
          severity: 'HIGH',
          symbol: position.symbol,
          message: `Position ${position.symbol} exceeds max size: ${(position.weight * 100).toFixed(2)}% > ${(config.riskLimits.maxPositionSize * 100)}%`,
          currentValue: position.weight,
          limit: config.riskLimits.maxPositionSize
        });
      }
    }

    // Check sector exposure
    const sectorExposure = portfolio.getSectorExposure();
    for (const [sector, exposure] of Object.entries(sectorExposure)) {
      if (exposure > config.riskLimits.maxSectorExposure) {
        violations.push({
          type: 'SECTOR_EXPOSURE',
          severity: 'MEDIUM',
          sector,
          message: `Sector ${sector} exceeds max exposure: ${(exposure * 100).toFixed(2)}% > ${(config.riskLimits.maxSectorExposure * 100)}%`,
          currentValue: exposure,
          limit: config.riskLimits.maxSectorExposure
        });
      }
    }

    // Check cash reserves
    const cashPercentage = portfolio.cash / portfolio.totalValue;
    if (cashPercentage < config.riskLimits.minCashReserve) {
      violations.push({
        type: 'LOW_CASH',
        severity: 'MEDIUM',
        message: `Cash reserves below minimum: ${(cashPercentage * 100).toFixed(2)}% < ${(config.riskLimits.minCashReserve * 100)}%`,
        currentValue: cashPercentage,
        limit: config.riskLimits.minCashReserve
      });
    }

    return violations;
  }

  async evaluateNewTrade(trade, portfolio) {
    // Clone portfolio and simulate trade
    const simulatedPortfolio = this.clonePortfolio(portfolio);
    
    if (trade.action === 'BUY') {
      simulatedPortfolio.addPosition(
        trade.symbol,
        trade.quantity,
        trade.price,
        trade.sector
      );
    } else if (trade.action === 'SELL') {
      const position = simulatedPortfolio.getPosition(trade.symbol);
      if (position) {
        if (trade.quantity >= position.quantity) {
          simulatedPortfolio.removePosition(trade.symbol);
        } else {
          position.quantity -= trade.quantity;
          simulatedPortfolio.updateMetrics();
        }
      }
    }

    // Check risk limits on simulated portfolio
    const violations = await this.checkRiskLimits(simulatedPortfolio);
    
    // Get market data for risk calculation
    const marketData = await this.dataHub.getMarketData([trade.symbol]);
    const riskMetrics = await this.calculateTradeRisk(trade, simulatedPortfolio, marketData);

    return {
      approved: violations.length === 0 && riskMetrics.acceptable,
      violations,
      riskMetrics,
      suggestedAdjustments: this.suggestAdjustments(trade, violations, riskMetrics)
    };
  }

  async calculateTradeRisk(trade, portfolio, marketData) {
    const positionRisk = this.riskCalculator.calculatePositionRisk(
      { symbol: trade.symbol, value: trade.quantity * trade.price },
      marketData[trade.symbol]
    );

    const portfolioRisk = await this.riskCalculator.calculatePortfolioRisk(
      portfolio,
      new Map(Object.entries(marketData))
    );

    return {
      positionVolatility: positionRisk.volatility,
      portfolioVolatility: portfolioRisk.portfolioVolatility,
      var95: portfolioRisk.var95,
      maxDrawdown: portfolioRisk.maxDrawdown,
      acceptable: this.isRiskAcceptable(portfolioRisk)
    };
  }

  isRiskAcceptable(riskMetrics) {
    return (
      riskMetrics.portfolioVolatility <= config.riskLimits.maxVolatility &&
      riskMetrics.maxDrawdown <= config.riskLimits.maxDrawdown &&
      riskMetrics.var95 <= config.riskLimits.maxDrawdown * riskMetrics.portfolioValue
    );
  }

  suggestAdjustments(trade, violations, riskMetrics) {
    const suggestions = [];

    // Position size adjustment
    const positionSizeViolation = violations.find(v => v.type === 'POSITION_SIZE');
    if (positionSizeViolation) {
      const maxQuantity = (config.riskLimits.maxPositionSize * trade.portfolioValue) / trade.price;
      suggestions.push({
        type: 'REDUCE_QUANTITY',
        suggestedQuantity: Math.floor(maxQuantity * 0.95), // 95% of max to leave buffer
        reason: 'Position size limit'
      });
    }

    // Volatility adjustment
    if (riskMetrics.portfolioVolatility > config.riskLimits.maxVolatility) {
      const reductionFactor = config.riskLimits.maxVolatility / riskMetrics.portfolioVolatility;
      suggestions.push({
        type: 'REDUCE_QUANTITY',
        suggestedQuantity: Math.floor(trade.quantity * reductionFactor),
        reason: 'Portfolio volatility limit'
      });
    }

    return suggestions;
  }

  clonePortfolio(portfolio) {
    const cloned = Object.create(Object.getPrototypeOf(portfolio));
    Object.assign(cloned, portfolio);
    cloned.positions = new Map(portfolio.positions);
    return cloned;
  }

  async generateRiskReport(portfolio) {
    const marketData = await this.fetchMarketDataForPortfolio(portfolio);
    const riskMetrics = await this.riskCalculator.calculatePortfolioRisk(portfolio, marketData);
    const violations = await this.checkRiskLimits(portfolio);
    const stressTests = await this.runStressTests(portfolio);

    return {
      timestamp: new Date().toISOString(),
      portfolio: portfolio.toJSON(),
      riskMetrics,
      violations,
      stressTests,
      recommendations: this.generateRecommendations(riskMetrics, violations),
      riskScore: this.calculateRiskScore(riskMetrics, violations)
    };
  }

  async fetchMarketDataForPortfolio(portfolio) {
    const symbols = Array.from(portfolio.positions.keys());
    const marketData = new Map();

    for (const symbol of symbols) {
      const data = await this.dataHub.getMarketData(symbol);
      marketData.set(symbol, data);
    }

    return marketData;
  }

  async runStressTests(portfolio) {
    const results = [];

    for (const scenario of config.riskLimits.stressTestScenarios) {
      const result = this.riskCalculator.performStressTest(portfolio, scenario);
      results.push(result);
    }

    return results;
  }

  generateRecommendations(riskMetrics, violations) {
    const recommendations = [];

    if (violations.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'REBALANCE',
        message: 'Portfolio has risk limit violations that need immediate attention'
      });
    }

    if (riskMetrics.portfolioVolatility > config.riskLimits.maxVolatility * 0.8) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'REDUCE_RISK',
        message: 'Portfolio volatility approaching limit, consider reducing exposure'
      });
    }

    if (riskMetrics.diversificationRatio < 1.2) {
      recommendations.push({
        priority: 'LOW',
        action: 'DIVERSIFY',
        message: 'Low diversification ratio, consider adding uncorrelated assets'
      });
    }

    return recommendations;
  }

  calculateRiskScore(riskMetrics, violations) {
    let score = 100;

    // Deduct for violations
    score -= violations.length * 10;
    score -= violations.filter(v => v.severity === 'HIGH').length * 10;

    // Deduct for high volatility
    const volRatio = riskMetrics.portfolioVolatility / config.riskLimits.maxVolatility;
    score -= Math.max(0, (volRatio - 0.5) * 50);

    // Deduct for poor Sharpe ratio
    if (riskMetrics.sharpeRatio < 1) {
      score -= (1 - riskMetrics.sharpeRatio) * 20;
    }

    return Math.max(0, Math.min(100, score));
  }
}