import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TournamentEngine } from '../../ai-coo/src/tournament/tournament-engine';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers';
import { Strategy } from '../../shared/types/strategy';

describe('Tournament System Integration', () => {
  let testEnv: any;
  let tournamentEngine: TournamentEngine;
  
  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
    tournamentEngine = new TournamentEngine(testEnv.mcpClient);
  });
  
  afterAll(async () => {
    await cleanupTestEnvironment(testEnv);
  });
  
  describe('Complete Tournament Execution', () => {
    it('should run tournament with multiple strategies and select optimal portfolio', async () => {
      // Create test strategies
      const strategies = await createTestStrategies();
      
      // Create tournament
      const tournamentId = await tournamentEngine.createTournament({
        name: 'Weekly Strategy Tournament',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        evaluationPeriod: '30d',
        minSharpe: 1.0,
        maxDrawdown: 0.15,
        capitalAllocation: 1000000,
        rebalanceFrequency: 'weekly'
      });
      
      expect(tournamentId).toMatch(/^tournament_\d+$/);
      
      // Run tournament
      const result = await tournamentEngine.runTournament(tournamentId);
      
      // Verify results
      expect(result).toMatchObject({
        tournament_id: tournamentId,
        rankings: expect.any(Array),
        selected_strategies: expect.any(Array),
        allocations: expect.any(Map),
        projected_performance: expect.objectContaining({
          expected_annual_return: expect.any(Number),
          expected_sharpe_ratio: expect.any(Number),
          expected_max_drawdown: expect.any(Number)
        })
      });
      
      // Verify selection criteria
      expect(result.selected_strategies.length).toBeGreaterThan(0);
      expect(result.selected_strategies.length).toBeLessThanOrEqual(10);
      
      // Verify allocations
      let totalAllocation = 0;
      result.allocations.forEach((allocation) => {
        expect(allocation).toBeGreaterThan(0);
        expect(allocation).toBeLessThanOrEqual(0.3); // Max 30% per strategy
        totalAllocation += allocation;
      });
      expect(totalAllocation).toBeCloseTo(1.0, 5);
      
      // Verify risk constraints
      expect(result.projected_performance.expected_sharpe_ratio).toBeGreaterThan(1.0);
      expect(result.projected_performance.expected_max_drawdown).toBeLessThan(0.15);
      
      // Execute tournament allocations
      const execution = await tournamentEngine.executeTournamentAllocations(tournamentId);
      
      expect(execution).toMatchObject({
        success: true,
        executed_trades: expect.any(Array),
        allocation_used: expect.any(Number)
      });
      
      // Monitor performance
      const monitoring = await tournamentEngine.monitorTournamentPerformance(tournamentId);
      
      expect(monitoring).toMatchObject({
        tournament_id: tournamentId,
        current_performance: expect.any(Array),
        vs_projection: expect.objectContaining({
          on_track: expect.any(Boolean)
        })
      });
    });
    
    it('should handle correlation constraints in portfolio construction', async () => {
      // Create highly correlated strategies
      const correlatedStrategies = await createCorrelatedStrategies();
      
      const tournamentId = await tournamentEngine.createTournament({
        name: 'Correlation Test Tournament',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        evaluationPeriod: '30d',
        minSharpe: 0.5,
        maxDrawdown: 0.25,
        capitalAllocation: 500000,
        rebalanceFrequency: 'monthly'
      });
      
      const result = await tournamentEngine.runTournament(tournamentId);
      
      // Verify low correlation between selected strategies
      const selectedPairs: string[][] = [];
      for (let i = 0; i < result.selected_strategies.length; i++) {
        for (let j = i + 1; j < result.selected_strategies.length; j++) {
          selectedPairs.push([
            result.selected_strategies[i],
            result.selected_strategies[j]
          ]);
        }
      }
      
      // Check correlations
      for (const [stratA, stratB] of selectedPairs) {
        const correlation = await testEnv.riskAnalyzer.callMethod('check_correlation', {
          asset1: stratA,
          asset2: stratB
        });
        
        expect(Math.abs(correlation.correlation)).toBeLessThan(0.6);
      }
    });
  });
  
  describe('AI-Driven Strategy Evaluation', () => {
    it('should incorporate AI insights in strategy ranking', async () => {
      const strategies = await createTestStrategies();
      
      // Get AI evaluation for each strategy
      const aiEvaluations = await Promise.all(
        strategies.map(async (strategy) => {
          return await testEnv.aiCoo.callMethod('evaluate_strategy', {
            strategy_id: strategy.id,
            market_context: await testEnv.contextManager.getContext('market')
          });
        })
      );
      
      // Verify AI provided meaningful insights
      aiEvaluations.forEach((evaluation) => {
        expect(evaluation).toMatchObject({
          strategy_id: expect.any(String),
          market_fit_score: expect.any(Number),
          risk_assessment: expect.any(String),
          recommendations: expect.any(Array),
          confidence: expect.any(Number)
        });
        
        expect(evaluation.market_fit_score).toBeGreaterThanOrEqual(0);
        expect(evaluation.market_fit_score).toBeLessThanOrEqual(1);
        expect(evaluation.confidence).toBeGreaterThanOrEqual(0);
        expect(evaluation.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
  
  describe('Risk Management Integration', () => {
    it('should enforce risk limits during tournament execution', async () => {
      // Set strict risk limits
      await testEnv.riskAnalyzer.callMethod('set_limits', {
        max_portfolio_var: 0.02, // 2% VaR
        max_position_size: 0.03, // 3% max per position
        max_correlation: 0.5
      });
      
      const tournamentId = await tournamentEngine.createTournament({
        name: 'Risk-Constrained Tournament',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        evaluationPeriod: '30d',
        minSharpe: 1.5,
        maxDrawdown: 0.10,
        capitalAllocation: 2000000,
        rebalanceFrequency: 'weekly'
      });
      
      const result = await tournamentEngine.runTournament(tournamentId);
      
      // Verify risk constraints were respected
      const portfolioRisk = await testEnv.riskAnalyzer.callMethod('analyze_portfolio', {
        portfolio: {
          positions: result.selected_strategies.map(id => ({
            strategy_id: id,
            value: result.allocations.get(id) * 2000000
          })),
          total_value: 2000000
        }
      });
      
      expect(portfolioRisk.var_95 / 2000000).toBeLessThan(0.02);
      expect(portfolioRisk.largest_position.percentage).toBeLessThan(0.03);
    });
  });
  
  // Helper functions
  async function createTestStrategies(): Promise<Strategy[]> {
    const strategies = [];
    
    // Create diverse strategies
    const types = ['momentum', 'mean_reversion', 'arbitrage', 'trend_following'];
    const assets = [['BTC', 'ETH'], ['SOL', 'AVAX'], ['BTC'], ['ETH', 'MATIC']];
    
    for (let i = 0; i < 20; i++) {
      const strategy = await testEnv.signalForge.callMethod('create_strategy', {
        name: `Test Strategy ${i}`,
        type: types[i % types.length],
        parameters: {
          entry_conditions: [
            { indicator: 'rsi', operator: 'lt', value: 30 + (i % 20) },
            { indicator: 'macd', operator: 'crosses_above', value: 0 }
          ],
          exit_conditions: [
            { indicator: 'rsi', operator: 'gt', value: 70 - (i % 20) },
            { indicator: 'macd', operator: 'crosses_below', value: 0 }
          ],
          position_sizing: {
            method: 'fixed',
            base_size: 0.02,
            max_size: 0.05
          },
          timeframe: '1h',
          assets: assets[i % assets.length],
          stop_loss: 0.03 + (i % 10) * 0.01,
          take_profit: 0.10 + (i % 10) * 0.02
        }
      });
      
      // Simulate performance
      strategy.performance = {
        total_return: 0.05 + Math.random() * 0.3,
        sharpe_ratio: 0.5 + Math.random() * 2.5,
        sortino_ratio: 0.7 + Math.random() * 3,
        max_drawdown: 0.05 + Math.random() * 0.15,
        win_rate: 0.4 + Math.random() * 0.3,
        profit_factor: 1 + Math.random() * 2,
        total_trades: 50 + Math.floor(Math.random() * 450),
        winning_trades: 0,
        losing_trades: 0,
        avg_win: 0.02,
        avg_loss: -0.01,
        best_trade: {} as any,
        worst_trade: {} as any,
        current_drawdown: 0,
        recovery_time_days: Math.floor(Math.random() * 30),
        var_95: 0.01 + Math.random() * 0.04,
        downside_deviation: 0.05 + Math.random() * 0.1
      };
      
      strategies.push(strategy);
    }
    
    return strategies;
  }
  
  async function createCorrelatedStrategies(): Promise<Strategy[]> {
    const strategies = [];
    
    // Create groups of highly correlated strategies
    const groups = [
      { type: 'momentum', assets: ['BTC', 'ETH'] },
      { type: 'momentum', assets: ['BTC', 'ETH'] }, // Same as above - high correlation
      { type: 'mean_reversion', assets: ['SOL'] },
      { type: 'mean_reversion', assets: ['AVAX'] }, // Different asset - low correlation
    ];
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const strategy = await testEnv.signalForge.callMethod('create_strategy', {
        name: `Correlated Strategy ${i}`,
        type: group.type,
        parameters: {
          entry_conditions: [
            { indicator: 'rsi', operator: 'lt', value: 30 }
          ],
          exit_conditions: [
            { indicator: 'rsi', operator: 'gt', value: 70 }
          ],
          assets: group.assets,
          timeframe: '1h'
        }
      });
      
      strategies.push(strategy);
    }
    
    return strategies;
  }
});
