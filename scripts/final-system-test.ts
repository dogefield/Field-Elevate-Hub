import { describe, it, expect } from '@jest/globals';
import axios from 'axios';

// Comprehensive system test that validates the entire Field Elevate platform
describe('Field Elevate Complete System Test', () => {
  const API_BASE = process.env.API_BASE || 'http://localhost:8000';
  
  describe('End-to-End User Journey', () => {
    it('should complete full investment lifecycle', async () => {
      // 1. Onboard new investor
      const investor = await createInvestor({
        name: 'Test Investor',
        email: 'test@example.com',
        initial_investment: 1000000
      });
      
      expect(investor.id).toBeTruthy();
      
      // 2. Run strategy tournament
      const tournament = await runTournament({
        capital: investor.initial_investment,
        risk_tolerance: 'moderate'
      });
      
      expect(tournament.selected_strategies.length).toBeGreaterThan(0);
      expect(tournament.selected_strategies.length).toBeLessThanOrEqual(10);
      
      // 3. Execute initial allocation
      const execution = await executeAllocation({
        investor_id: investor.id,
        allocations: tournament.allocations
      });
      
      expect(execution.success).toBe(true);
      expect(execution.trades_executed).toBeGreaterThan(0);
      
      // 4. Monitor for 24 hours (simulated)
      await simulateMarketActivity(24);
      
      // 5. Check performance
      const performance = await getPerformance(investor.id);
      
      expect(performance.total_value).toBeGreaterThan(0);
      expect(performance.positions.length).toBeGreaterThan(0);
      
      // 6. Generate report
      const report = await generateReport({
        investor_id: investor.id,
        type: 'monthly'
      });
      
      expect(report.pdf_url).toBeTruthy();
      
      // 7. Test risk event
      await triggerRiskEvent('high_volatility');
      
      // 8. Verify risk response
      const riskResponse = await getRiskResponse();
      
      expect(riskResponse.actions_taken).toContain('position_reduction');
      
      // 9. Test rebalancing
      const rebalance = await triggerRebalance(investor.id);
      
      expect(rebalance.success).toBe(true);
      
      // 10. Final performance check
      const finalPerformance = await getPerformance(investor.id);
      
      expect(finalPerformance.risk_metrics.var_95).toBeLessThan(
        investor.initial_investment * 0.05
      );
    });
  });
  
  describe('System Resilience', () => {
    it('should handle component failures gracefully', async () => {
      // Test each component failure
      const components = [
        'data-hub',
        'signal-forge',
        'trade-runner',
        'risk-analyzer'
      ];
      
      for (const component of components) {
        // Simulate component failure
        await simulateComponentFailure(component);
        
        // Verify system continues operating
        const health = await getSystemHealth();
        expect(health.overall_status).not.toBe('critical');
        
        // Verify failover/recovery
        await waitForRecovery(component);
        
        const componentHealth = await getComponentHealth(component);
        expect(componentHealth.status).toBe('healthy');
      }
    });
    
    it('should maintain data consistency under load', async () => {
      // Generate high load
      const promises = [] as any[];
      for (let i = 0; i < 1000; i++) {
        promises.push(
          createOrder({
            asset: 'BTC',
            side: i % 2 === 0 ? 'buy' : 'sell',
            quantity: Math.random() * 0.1
          })
        );
      }
      
      const results = await Promise.allSettled(promises);
      
      // Check success rate
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful / results.length).toBeGreaterThan(0.95);
      
      // Verify data consistency
      const portfolio = await getPortfolioState();
      const positions = await getPositions();
      
      // Portfolio value should match sum of positions
      const calculatedValue = positions.reduce((sum, p) => sum + p.value, 0);
      expect(Math.abs(portfolio.total_value - calculatedValue)).toBeLessThan(1);
    });
  });
  
  describe('AI System Intelligence', () => {
    it('should demonstrate learning from market events', async () => {
      // Get baseline strategy performance
      const baselineStrategies = await getActiveStrategies();
      const baselinePerformance = calculateAveragePerformance(baselineStrategies);
      
      // Simulate various market conditions
      await simulateMarketConditions([
        { type: 'bull_market', duration: 7 },
        { type: 'bear_market', duration: 7 },
        { type: 'high_volatility', duration: 3 },
        { type: 'flash_crash', duration: 1 }
      ]);
      
      // Let AI learn and adapt
      await triggerAILearning();
      
      // Get updated strategies
      const updatedStrategies = await getActiveStrategies();
      const updatedPerformance = calculateAveragePerformance(updatedStrategies);
      
      // Performance should improve
      expect(updatedPerformance.sharpe_ratio).toBeGreaterThan(
        baselinePerformance.sharpe_ratio
      );
      
      // Strategies should show adaptation
      const adaptations = findStrategyAdaptations(baselineStrategies, updatedStrategies);
      expect(adaptations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Security and Compliance', () => {
    it('should enforce all security policies', async () => {
      // Test authentication
      const unauthorizedResult = await makeUnauthorizedRequest();
      expect(unauthorizedResult.status).toBe(401);
      
      // Test rate limiting
      const rateLimitResult = await testRateLimit();
      expect(rateLimitResult.limited).toBe(true);
      
      // Test data encryption
      const encryptionTest = await verifyEncryption();
      expect(encryptionTest.all_encrypted).toBe(true);
      
      // Test audit logging
      const auditLogs = await getAuditLogs({ limit: 100 });
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toHaveProperty('user');
      expect(auditLogs[0]).toHaveProperty('action');
      expect(auditLogs[0]).toHaveProperty('timestamp');
    });
    
    it('should enforce trading compliance rules', async () => {
      // Test position limits
      const oversizedOrder = await attemptOversizedOrder();
      expect(oversizedOrder.rejected).toBe(true);
      expect(oversizedOrder.reason).toContain('position_limit');
      
      // Test restricted assets
      const restrictedOrder = await attemptRestrictedAsset();
      expect(restrictedOrder.rejected).toBe(true);
      expect(restrictedOrder.reason).toContain('restricted_asset');
      
      // Test wash trading prevention
      const washTrade = await attemptWashTrade();
      expect(washTrade.rejected).toBe(true);
      expect(washTrade.reason).toContain('wash_trade');
    });
  });
  
  // Helper functions
  async function createInvestor(data: any) {
    const response = await axios.post(`${API_BASE}/investors`, data);
    return response.data;
  }
  
  async function runTournament(params: any) {
    const response = await axios.post(`${API_BASE}/tournaments`, params);
    return response.data;
  }
  
  async function executeAllocation(params: any) {
    const response = await axios.post(`${API_BASE}/allocations/execute`, params);
    return response.data;
  }
  
  async function simulateMarketActivity(hours: number) {
    await axios.post(`${API_BASE}/test/simulate-market`, { hours });
    // Wait for simulation to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  async function getPerformance(investorId: string) {
    const response = await axios.get(`${API_BASE}/investors/${investorId}/performance`);
    return response.data;
  }
  
  async function generateReport(params: any) {
    const response = await axios.post(`${API_BASE}/reports/generate`, params);
    return response.data;
  }
  
  async function triggerRiskEvent(type: string) {
    await axios.post(`${API_BASE}/test/trigger-risk-event`, { type });
  }
  
  async function getRiskResponse() {
    const response = await axios.get(`${API_BASE}/risk/latest-response`);
    return response.data;
  }
  
  async function triggerRebalance(investorId: string) {
    const response = await axios.post(`${API_BASE}/portfolios/${investorId}/rebalance`);
    return response.data;
  }
  
  async function simulateComponentFailure(component: string) {
    await axios.post(`${API_BASE}/test/simulate-failure`, { component });
  }
  
  async function getSystemHealth() {
    const response = await axios.get(`${API_BASE}/health/system`);
    return response.data;
  }
  
  async function waitForRecovery(component: string) {
    let attempts = 0;
    while (attempts < 30) {
      const health = await getComponentHealth(component);
      if (health.status === 'healthy') return;
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    throw new Error(`Component ${component} did not recover`);
  }
  
  async function getComponentHealth(component: string) {
    const response = await axios.get(`${API_BASE}/health/${component}`);
    return response.data;
  }
  
  async function createOrder(order: any) {
    const response = await axios.post(`${API_BASE}/orders`, order);
    return response.data;
  }
  
  async function getPortfolioState() {
    const response = await axios.get(`${API_BASE}/portfolio`);
    return response.data;
  }
  
  async function getPositions() {
    const response = await axios.get(`${API_BASE}/positions`);
    return response.data;
  }
  
  async function getActiveStrategies() {
    const response = await axios.get(`${API_BASE}/strategies?active=true`);
    return response.data;
  }
  
  function calculateAveragePerformance(strategies: any[]) {
    const total = strategies.reduce((acc, s) => ({
      sharpe_ratio: acc.sharpe_ratio + s.performance.sharpe_ratio,
      total_return: acc.total_return + s.performance.total_return,
      win_rate: acc.win_rate + s.performance.win_rate
    }), { sharpe_ratio: 0, total_return: 0, win_rate: 0 });
    
    return {
      sharpe_ratio: total.sharpe_ratio / strategies.length,
      total_return: total.total_return / strategies.length,
      win_rate: total.win_rate / strategies.length
    };
  }
  
  async function simulateMarketConditions(conditions: any[]) {
    for (const condition of conditions) {
      await axios.post(`${API_BASE}/test/market-condition`, condition);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  async function triggerAILearning() {
    const response = await axios.post(`${API_BASE}/ai/learn`);
    return response.data;
  }
  
  function findStrategyAdaptations(baseline: any[], updated: any[]) {
    const adaptations = [] as any[];
    
    for (const updatedStrategy of updated) {
      const baselineStrategy = baseline.find(b => b.id === updatedStrategy.id);
      if (baselineStrategy) {
        const changes = compareStrategies(baselineStrategy, updatedStrategy);
        if (changes.length > 0) {
          adaptations.push({ strategy_id: updatedStrategy.id, changes });
        }
      }
    }
    
    return adaptations;
  }
  
  function compareStrategies(baseline: any, updated: any): any[] {
    const changes = [] as any[];
    
    // Compare parameters
    if (JSON.stringify(baseline.parameters) !== JSON.stringify(updated.parameters)) {
      changes.push({ type: 'parameters', details: 'Parameters modified' });
    }
    
    // Compare allocations
    if (baseline.allocation !== updated.allocation) {
      changes.push({
        type: 'allocation',
        from: baseline.allocation,
        to: updated.allocation
      });
    }
    
    return changes;
  }
  
  async function makeUnauthorizedRequest() {
    try {
      await axios.get(`${API_BASE}/protected-endpoint`);
      return { status: 200 };
    } catch (error: any) {
      return { status: error.response?.status || 500 };
    }
  }
  
  async function testRateLimit() {
    const promises = [] as any[];
    for (let i = 0; i < 200; i++) {
      promises.push(axios.get(`${API_BASE}/health`).catch(e => e));
    }
    
    const results = await Promise.all(promises);
    const limited = results.some(r => (r as any).response?.status === 429);
    
    return { limited };
  }
  
  async function verifyEncryption() {
    const response = await axios.get(`${API_BASE}/security/encryption-status`);
    return response.data;
  }
  
  async function getAuditLogs(params: any) {
    const response = await axios.get(`${API_BASE}/audit/logs`, { params });
    return response.data;
  }
  
  async function attemptOversizedOrder() {
    try {
      await axios.post(`${API_BASE}/orders`, {
        asset: 'BTC',
        side: 'buy',
        quantity: 1000000 // Oversized
      });
      return { rejected: false };
    } catch (error: any) {
      return {
        rejected: true,
        reason: error.response?.data?.reason || 'unknown'
      };
    }
  }
  
  async function attemptRestrictedAsset() {
    try {
      await axios.post(`${API_BASE}/orders`, {
        asset: 'RESTRICTED_TOKEN',
        side: 'buy',
        quantity: 1
      });
      return { rejected: false };
    } catch (error: any) {
      return {
        rejected: true,
        reason: error.response?.data?.reason || 'unknown'
      };
    }
  }
  
  async function attemptWashTrade() {
    try {
      // Buy and immediately sell
      await axios.post(`${API_BASE}/orders`, {
        asset: 'ETH',
        side: 'buy',
        quantity: 10
      });
      
      await axios.post(`${API_BASE}/orders`, {
        asset: 'ETH',
        side: 'sell',
        quantity: 10
      });
      
      return { rejected: false };
    } catch (error: any) {
      return {
        rejected: true,
        reason: error.response?.data?.reason || 'unknown'
      };
    }
  }
});
