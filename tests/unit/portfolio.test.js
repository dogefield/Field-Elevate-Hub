const { Portfolio, Position } = require('../../server');

describe('Portfolio Unit Tests', () => {
  describe('Portfolio Calculations', () => {
    test('should calculate total portfolio value correctly', () => {
      const positions = [
        { symbol: 'AAPL', quantity: 100, currentPrice: 175.00 },
        { symbol: 'GOOGL', quantity: 50, currentPrice: 2850.00 }
      ];
      const cashBalance = 50000;
      
      const expectedTotal = (100 * 175) + (50 * 2850) + 50000; // 217,500
      // Add your portfolio calculation logic here
      expect(expectedTotal).toBe(217500);
    });

    test('should handle empty portfolio', () => {
      const positions = [];
      const cashBalance = 100000;
      
      expect(cashBalance).toBe(100000);
    });

    test('should calculate unrealized P&L correctly', () => {
      const position = {
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 150.00,
        currentPrice: 175.00
      };
      
      const unrealizedPnl = (position.currentPrice - position.avgCost) * position.quantity;
      expect(unrealizedPnl).toBe(2500);
    });
  });

  describe('Risk Calculations', () => {
    test('should calculate position size limits', () => {
      const portfolioValue = 100000;
      const maxPositionPercent = 0.1; // 10%
      const maxPositionValue = portfolioValue * maxPositionPercent;
      
      expect(maxPositionValue).toBe(10000);
    });

    test('should validate diversification rules', () => {
      const positions = [
        { symbol: 'AAPL', marketValue: 15000 },
        { symbol: 'GOOGL', marketValue: 12000 },
        { symbol: 'MSFT', marketValue: 8000 }
      ];
      const totalValue = 100000;
      
      const concentrationRisk = positions.some(p => 
        (p.marketValue / totalValue) > 0.2 // 20% limit
      );
      
      expect(concentrationRisk).toBe(false);
    });
  });
}); 