import { std, sqrt, mean, quantileSeq } from 'mathjs';
import { config } from '../config.js';

export class RiskCalculator {
  constructor() {
    this.historicalReturns = new Map();
    this.correlationMatrix = null;
    this.lastCorrelationUpdate = null;
  }

  calculatePositionRisk(position, marketData) {
    const volatility = this.calculateVolatility(marketData.bars);
    const beta = this.calculateBeta(marketData.bars, marketData.marketBars);
    const sharpeRatio = this.calculateSharpe(marketData.bars);
    
    return {
      symbol: position.symbol,
      volatility,
      beta,
      sharpeRatio,
      dollarRisk: position.value * volatility,
      percentRisk: volatility,
      downsideRisk: this.calculateDownsideRisk(marketData.bars)
    };
  }

  calculatePortfolioRisk(portfolio, marketDataMap) {
    const positions = portfolio.getPositions();
    const weights = positions.map(p => p.weight);
    const returns = [];

    // Calculate individual position risks
    const positionRisks = positions.map(position => {
      const marketData = marketDataMap.get(position.symbol);
      if (!marketData) return null;
      
      const risk = this.calculatePositionRisk(position, marketData);
      returns.push(this.calculateReturns(marketData.bars));
      return risk;
    }).filter(r => r !== null);

    // Portfolio volatility
    const portfolioVolatility = this.calculatePortfolioVolatility(weights, returns);
    
    // Value at Risk (VaR)
    const var95 = this.calculateVaR(portfolio.totalValue, portfolioVolatility, config.riskLimits.varConfidence);
    
    // Maximum drawdown
    const maxDrawdown = this.calculateMaxDrawdown(returns);

    return {
      portfolioVolatility,
      var95,
      maxDrawdown,
      sharpeRatio: this.calculatePortfolioSharpe(returns, weights),
      beta: this.calculatePortfolioBeta(positionRisks, weights),
      positionRisks,
      diversificationRatio: this.calculateDiversificationRatio(positionRisks, weights, portfolioVolatility)
    };
  }

  calculateVolatility(bars) {
    const returns = this.calculateReturns(bars);
    return std(returns) * sqrt(252); // Annualized
  }

  calculateReturns(bars) {
    const returns = [];
    for (let i = 1; i < bars.length; i++) {
      const ret = (bars[i].close - bars[i-1].close) / bars[i-1].close;
      returns.push(ret);
    }
    return returns;
  }

  calculateBeta(assetBars, marketBars) {
    const assetReturns = this.calculateReturns(assetBars);
    const marketReturns = this.calculateReturns(marketBars);
    
    const minLength = Math.min(assetReturns.length, marketReturns.length);
    const assetRet = assetReturns.slice(0, minLength);
    const marketRet = marketReturns.slice(0, minLength);
    
    const covariance = this.calculateCovariance(assetRet, marketRet);
    const marketVariance = std(marketRet) ** 2;
    
    return covariance / marketVariance;
  }

  calculateCovariance(returns1, returns2) {
    const mean1 = mean(returns1);
    const mean2 = mean(returns2);
    let sum = 0;
    
    for (let i = 0; i < returns1.length; i++) {
      sum += (returns1[i] - mean1) * (returns2[i] - mean2);
    }
    
    return sum / (returns1.length - 1);
  }

  calculateSharpe(bars, riskFreeRate = 0.02) {
    const returns = this.calculateReturns(bars);
    const avgReturn = mean(returns) * 252; // Annualized
    const volatility = std(returns) * sqrt(252);
    
    return (avgReturn - riskFreeRate) / volatility;
  }

  calculateVaR(portfolioValue, volatility, confidence) {
    // Using parametric VaR (assumes normal distribution)
    const zScore = this.getZScore(confidence);
    const dailyVolatility = volatility / sqrt(252);
    
    return portfolioValue * dailyVolatility * zScore;
  }

  getZScore(confidence) {
    // Approximate z-scores for common confidence levels
    const zScores = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326
    };
    return zScores[confidence] || 1.645;
  }

  calculateMaxDrawdown(returns) {
    let peak = 1;
    let maxDrawdown = 0;
    let value = 1;
    
    for (const ret of returns) {
      value *= (1 + ret);
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  calculatePortfolioVolatility(weights, returnsArray) {
    // Simplified - assumes no correlation
    // In production, use full correlation matrix
    let variance = 0;
    
    for (let i = 0; i < weights.length; i++) {
      const vol = std(returnsArray[i]) * sqrt(252);
      variance += (weights[i] ** 2) * (vol ** 2);
    }
    
    return sqrt(variance);
  }

  calculatePortfolioSharpe(returnsArray, weights) {
    // Weighted average of Sharpe ratios
    let weightedSharpe = 0;
    
    for (let i = 0; i < weights.length; i++) {
      const sharpe = this.calculateSharpeFromReturns(returnsArray[i]);
      weightedSharpe += weights[i] * sharpe;
    }
    
    return weightedSharpe;
  }

  calculateSharpeFromReturns(returns, riskFreeRate = 0.02) {
    const avgReturn = mean(returns) * 252;
    const volatility = std(returns) * sqrt(252);
    return (avgReturn - riskFreeRate) / volatility;
  }

  calculatePortfolioBeta(positionRisks, weights) {
    let weightedBeta = 0;
    
    for (let i = 0; i < positionRisks.length; i++) {
      weightedBeta += weights[i] * positionRisks[i].beta;
    }
    
    return weightedBeta;
  }

  calculateDownsideRisk(bars, threshold = 0) {
    const returns = this.calculateReturns(bars);
    const downsideReturns = returns.filter(r => r < threshold);
    
    if (downsideReturns.length === 0) return 0;
    
    return std(downsideReturns) * sqrt(252);
  }

  calculateDiversificationRatio(positionRisks, weights, portfolioVolatility) {
    let weightedVolSum = 0;
    
    for (let i = 0; i < positionRisks.length; i++) {
      weightedVolSum += weights[i] * positionRisks[i].volatility;
    }
    
    return weightedVolSum / portfolioVolatility;
  }

  performStressTest(portfolio, scenario) {
    const stressedValue = portfolio.totalValue;
    const results = [];

    for (const position of portfolio.getPositions()) {
      let stressedPrice = position.currentPrice;
      
      // Apply market-wide shock
      if (scenario.marketDrop) {
        stressedPrice *= (1 + scenario.marketDrop);
      }
      
      // Apply sector-specific shocks
      if (scenario.sectorDrops && scenario.sectorDrops[position.sector]) {
        stressedPrice *= (1 + scenario.sectorDrops[position.sector]);
      }
      
      // Apply volatility adjustment
      if (scenario.volatilitySpike) {
        const randomShock = (Math.random() - 0.5) * scenario.volatilitySpike * 0.1;
        stressedPrice *= (1 + randomShock);
      }
      
      const stressedValue = position.quantity * stressedPrice;
      const loss = position.value - stressedValue;
      
      results.push({
        symbol: position.symbol,
        originalValue: position.value,
        stressedValue,
        loss,
        lossPercent: loss / position.value
      });
    }

    const totalLoss = results.reduce((sum, r) => sum + r.loss, 0);
    
    return {
      scenario: scenario.name,
      results,
      totalLoss,
      lossPercent: totalLoss / portfolio.totalValue,
      survivable: totalLoss < portfolio.totalValue * config.riskLimits.maxDrawdown
    };
  }
}