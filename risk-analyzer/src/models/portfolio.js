export class Portfolio {
  constructor() {
    this.positions = new Map();
    this.cash = 0;
    this.totalValue = 0;
    this.lastUpdated = null;
  }

  addPosition(symbol, quantity, price, sector = 'unknown') {
    this.positions.set(symbol, {
      symbol,
      quantity,
      avgPrice: price,
      currentPrice: price,
      value: quantity * price,
      sector,
      weight: 0,
      unrealizedPnL: 0,
      realizedPnL: 0
    });
    this.updateMetrics();
  }

  updatePosition(symbol, currentPrice) {
    const position = this.positions.get(symbol);
    if (!position) return;

    position.currentPrice = currentPrice;
    position.value = position.quantity * currentPrice;
    position.unrealizedPnL = (currentPrice - position.avgPrice) * position.quantity;
    
    this.updateMetrics();
  }

  removePosition(symbol) {
    this.positions.delete(symbol);
    this.updateMetrics();
  }

  updateMetrics() {
    this.totalValue = this.cash;
    
    for (const position of this.positions.values()) {
      this.totalValue += position.value;
    }

    // Update weights
    for (const position of this.positions.values()) {
      position.weight = position.value / this.totalValue;
    }

    this.lastUpdated = new Date();
  }

  getPositions() {
    return Array.from(this.positions.values());
  }

  getPosition(symbol) {
    return this.positions.get(symbol);
  }

  getSectorExposure() {
    const sectors = {};
    
    for (const position of this.positions.values()) {
      if (!sectors[position.sector]) {
        sectors[position.sector] = 0;
      }
      sectors[position.sector] += position.weight;
    }

    return sectors;
  }

  getLargestPositions(n = 5) {
    return this.getPositions()
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  getTotalPnL() {
    let totalUnrealized = 0;
    let totalRealized = 0;

    for (const position of this.positions.values()) {
      totalUnrealized += position.unrealizedPnL;
      totalRealized += position.realizedPnL;
    }

    return {
      unrealized: totalUnrealized,
      realized: totalRealized,
      total: totalUnrealized + totalRealized
    };
  }

  toJSON() {
    return {
      positions: this.getPositions(),
      cash: this.cash,
      totalValue: this.totalValue,
      sectorExposure: this.getSectorExposure(),
      pnl: this.getTotalPnL(),
      lastUpdated: this.lastUpdated
    };
  }
}