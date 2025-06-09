import { EventEmitter } from 'events';
import { BaseAgent } from './base-agent';
import { StrategyRankerAgent } from './strategy-ranker';
import { RiskMonitorAgent } from './risk-monitor';
import { ExecutionAgent } from './execution-agent';
import { MarketAnalystAgent } from './market-analyst';
import { PerformanceAnalystAgent } from './performance-analyst';
import { ComplianceAgent } from './compliance-agent';
import { ReportingAgent } from './reporting-agent';

export class MasterCoordinator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private activeWorkflows: Map<string, any> = new Map();
  private mcpClient: any;
  
  constructor(mcpClient: any) {
    super();
    this.mcpClient = mcpClient;
    this.initializeAgents();
  }
  
  private initializeAgents() {
    // Initialize all specialized agents
    this.agents.set('strategy_ranker', new StrategyRankerAgent());
    this.agents.set('risk_monitor', new RiskMonitorAgent());
    this.agents.set('execution', new ExecutionAgent());
    this.agents.set('market_analyst', new MarketAnalystAgent());
    this.agents.set('performance_analyst', new PerformanceAnalystAgent());
    this.agents.set('compliance', new ComplianceAgent());
    this.agents.set('reporting', new ReportingAgent());
    
    // Connect agents to MCP
    this.agents.forEach((agent, id) => {
      agent.setMCPClient(this.mcpClient);
      agent.on('action_completed', (result) => this.handleAgentAction(id, result));
      agent.on('error', (error) => this.handleAgentError(id, error));
    });
  }
  
  async executeWorkflow(workflowType: string, params: any): Promise<any> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const workflow = {
      id: workflowId,
      type: workflowType,
      params,
      status: 'running',
      started_at: new Date(),
      steps: [] as any[],
      results: {}
    };
    
    this.activeWorkflows.set(workflowId, workflow);
    
    try {
      let result;
      
      switch (workflowType) {
        case 'daily_operations':
          result = await this.executeDailyOperations(workflow);
          break;
          
        case 'strategy_evaluation':
          result = await this.executeStrategyEvaluation(workflow);
          break;
          
        case 'risk_assessment':
          result = await this.executeRiskAssessment(workflow);
          break;
          
        case 'portfolio_rebalance':
          result = await this.executePortfolioRebalance(workflow);
          break;
          
        case 'emergency_response':
          result = await this.executeEmergencyResponse(workflow);
          break;
          
        case 'report_generation':
          result = await this.executeReportGeneration(workflow);
          break;
          
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }
      
      workflow.status = 'completed';
      workflow.completed_at = new Date();
      workflow.results = result;
      
      // Store workflow results
      await this.storeWorkflowResults(workflow);
      
      return result;
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.error = (error as Error).message;
      workflow.failed_at = new Date();
      
      // Handle workflow failure
      await this.handleWorkflowFailure(workflow, error as Error);
      
      throw error;
      
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }
  
  private async executeDailyOperations(workflow: any): Promise<any> {
    const steps = [
      { name: 'market_analysis', agent: 'market_analyst' },
      { name: 'portfolio_review', agent: 'performance_analyst' },
      { name: 'risk_check', agent: 'risk_monitor' },
      { name: 'strategy_ranking', agent: 'strategy_ranker' },
      { name: 'compliance_check', agent: 'compliance' },
      { name: 'execution_planning', agent: 'execution' },
      { name: 'report_generation', agent: 'reporting' }
    ];
    
    const results: any = {};
    
    for (const step of steps) {
      workflow.steps.push({
        name: step.name,
        status: 'running',
        started_at: new Date()
      });
      
      try {
        // Execute step
        const agent = this.agents.get(step.agent);
        const stepResult = await agent!.execute({
          action: step.name,
          context: {
            workflow_id: workflow.id,
            previous_results: results,
            params: workflow.params
          }
        });
        
        results[step.name] = stepResult;
        
        // Update step status
        const currentStep = workflow.steps[workflow.steps.length - 1];
        currentStep.status = 'completed';
        currentStep.completed_at = new Date();
        currentStep.result = stepResult;
        
        // Check if we should continue
        if (stepResult.halt_workflow) {
          break;
        }
        
      } catch (error) {
        const currentStep = workflow.steps[workflow.steps.length - 1];
        currentStep.status = 'failed';
        currentStep.error = (error as Error).message;
        currentStep.failed_at = new Date();
        
        // Determine if we should continue or fail the workflow
        if (this.isCriticalStep(step.name)) {
          throw error;
        }
      }
    }
    
    return results;
  }
  
  private async executeStrategyEvaluation(workflow: any): Promise<any> {
    // Get current strategies
    const strategies = await this.mcpClient.callApp('signal-forge', 'get_strategies', {
      active_only: true
    });
    
    // Parallel evaluation by multiple agents
    const evaluations = await Promise.all([
      this.agents.get('strategy_ranker')!.evaluate({ strategies }),
      this.agents.get('risk_monitor')!.evaluateStrategies({ strategies }),
      this.agents.get('market_analyst')!.evaluateMarketFit({ strategies })
    ]);
    
    // Synthesize results
    const synthesis = await this.synthesizeEvaluations(evaluations);
    
    // Generate recommendations
    const recommendations = await this.agents.get('strategy_ranker')!.generateRecommendations({
      evaluations: synthesis,
      current_portfolio: await this.mcpClient.getContext('portfolio')
    });
    
    return {
      evaluations: synthesis,
      recommendations,
      top_strategies: recommendations.top_5,
      suggested_changes: recommendations.changes
    };
  }
  
  private async executeRiskAssessment(workflow: any): Promise<any> {
    const riskAgent = this.agents.get('risk_monitor')!;
    
    // Comprehensive risk analysis
    const analyses = await Promise.all([
      riskAgent.analyzePortfolioRisk(),
      riskAgent.analyzeMarketRisk(),
      riskAgent.analyzeOperationalRisk(),
      riskAgent.analyzeLiquidityRisk()
    ]);
    
    // Stress testing
    const stressTests = await riskAgent.runStressTests({
      scenarios: workflow.params.scenarios || [
        'market_crash',
        'flash_crash',
        'liquidity_crisis',
        'correlation_breakdown'
      ]
    });
    
    // Generate risk report
    const riskReport = await riskAgent.generateRiskReport({
      analyses,
      stress_tests: stressTests,
      recommendations: true
    });
    
    // Alert if critical risks found
    if (riskReport.critical_risks.length > 0) {
      await this.handleCriticalRisks(riskReport.critical_risks);
    }
    
    return riskReport;
  }
  
  private async executePortfolioRebalance(workflow: any): Promise<any> {
    // Run strategy tournament
    const tournament = await this.runStrategyTournament(workflow.params);
    
    // Risk check proposed allocations
    const riskCheck = await this.agents.get('risk_monitor')!.checkProposedAllocations({
      allocations: tournament.allocations,
      current_portfolio: await this.mcpClient.getContext('portfolio')
    });
    
    if (!riskCheck.approved) {
      // Adjust allocations based on risk feedback
      tournament.allocations = await this.adjustAllocationsForRisk(
        tournament.allocations,
        riskCheck.constraints
      );
    }
    
    // Compliance check
    const complianceCheck = await this.agents.get('compliance')!.checkAllocations({
      allocations: tournament.allocations
    });
    
    if (!complianceCheck.approved) {
      throw new Error(`Compliance check failed: ${complianceCheck.reason}`);
    }
    
    // Execute rebalance
    const execution = await this.agents.get('execution')!.executeRebalance({
      allocations: tournament.allocations,
      execution_style: workflow.params.execution_style || 'patient',
      time_limit: workflow.params.time_limit || '4h'
    });
    
    return {
      tournament_results: tournament,
      risk_adjustments: riskCheck.adjustments,
      execution: execution,
      new_portfolio: await this.mcpClient.getContext('portfolio')
    };
  }
  
  private async executeEmergencyResponse(workflow: any): Promise<any> {
    const { trigger, severity } = workflow.params;
    
    // Immediate actions
    const immediateActions = await this.executeImmediateActions(trigger, severity);
    
    // Risk assessment
    const riskAssessment = await this.agents.get('risk_monitor')!.assessEmergency({
      trigger,
      current_state: await this.getCurrentSystemState()
    });
    
    // Determine response strategy
    const responseStrategy = await this.determineResponseStrategy(
      trigger,
      riskAssessment
    );
    
    // Execute response
    const responseResults = await this.executeResponseStrategy(responseStrategy);
    
    // Generate incident report
    const incidentReport = await this.agents.get('reporting')!.generateIncidentReport({
      trigger,
      actions_taken: immediateActions,
      response_strategy: responseStrategy,
      results: responseResults,
      recommendations: await this.generatePostIncidentRecommendations()
    });
    
    return {
      immediate_actions: immediateActions,
      risk_assessment: riskAssessment,
      response_executed: responseResults,
      incident_report: incidentReport
    };
  }
  
  private async executeReportGeneration(workflow: any): Promise<any> {
    const { report_type, recipients, include_sections } = workflow.params;
    
    // Gather data from all agents
    const agentReports = await Promise.all(
      Array.from(this.agents.entries()).map(async ([id, agent]) => {
        return {
          agent_id: id,
          report: await agent.generateReport({ timeframe: workflow.params.timeframe })
        };
      })
    );
    
    // Compile master report
    const masterReport = await this.agents.get('reporting')!.compileMasterReport({
      report_type,
      agent_reports: agentReports,
      include_sections: include_sections || 'all',
      executive_summary: true
    });
    
    // Generate visualizations
    const visualizations = await this.generateReportVisualizations(masterReport);
    
    // Send to recipients
    if (recipients && recipients.length > 0) {
      await this.distributeReport(masterReport, visualizations, recipients);
    }
    
    return {
      report: masterReport,
      visualizations,
      distributed_to: recipients || []
    };
  }
  
  // Helper methods
  private async handleAgentAction(agentId: string, result: any) {
    this.emit('agent_action', {
      agent_id: agentId,
      action: result.action,
      outcome: result.outcome,
      timestamp: new Date()
    });
    
    // Check if action requires coordination
    if (result.requires_coordination) {
      await this.coordinateAgentActions(agentId, result);
    }
  }
  
  private async handleAgentError(agentId: string, error: any) {
    console.error(`Agent ${agentId} error:`, error);
    
    // Log to monitoring system
    await this.mcpClient.streamData('agent:error', {
      agent_id: agentId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    
    // Attempt recovery
    await this.attemptAgentRecovery(agentId, error);
  }
  
  private async coordinateAgentActions(initiatingAgent: string, action: any) {
    // Determine which agents need to be involved
    const involvedAgents = this.determineInvolvedAgents(action);
    
    // Create coordination plan
    const coordinationPlan = {
      initiating_agent: initiatingAgent,
      action: action.action,
      involved_agents: involvedAgents,
      sequence: this.determineActionSequence(action, involvedAgents)
    };
    
    // Execute coordinated actions
    for (const step of coordinationPlan.sequence) {
      const agent = this.agents.get(step.agent_id)!;
      await agent.execute({
        action: step.action,
        context: {
          coordination_plan: coordinationPlan,
          previous_results: step.dependencies
        }
      });
    }
  }
  
  private determineInvolvedAgents(action: any): string[] {
    const agentMap: Record<string, string[]> = {
      'trade_execution': ['risk_monitor', 'compliance', 'execution'],
      'strategy_change': ['strategy_ranker', 'risk_monitor', 'performance_analyst'],
      'risk_alert': ['risk_monitor', 'execution', 'reporting'],
      'compliance_issue': ['compliance', 'execution', 'reporting']
    };
    
    return agentMap[action.type] || [];
  }
  
  private determineActionSequence(action: any, agents: string[]): any[] {
    // Define action dependencies and sequence
    const sequences: Record<string, any[]> = {
      'trade_execution': [
        { agent_id: 'risk_monitor', action: 'pre_trade_check' },
        { agent_id: 'compliance', action: 'validate_trade' },
        { agent_id: 'execution', action: 'execute_trade' }
      ],
      'strategy_change': [
        { agent_id: 'strategy_ranker', action: 'evaluate_change' },
        { agent_id: 'risk_monitor', action: 'assess_impact' },
        { agent_id: 'performance_analyst', action: 'project_performance' }
      ]
    };
    
    return sequences[action.type] || agents.map(a => ({ agent_id: a, action: 'process' }));
  }
  
  private async attemptAgentRecovery(agentId: string, error: any) {
    const agent = this.agents.get(agentId)!;
    
    try {
      // Reset agent state
      await agent.reset();
      
      // Reinitialize connections
      await agent.initialize();
      
      console.log(`Agent ${agentId} recovered successfully`);
      
    } catch (recoveryError) {
      console.error(`Failed to recover agent ${agentId}:`, recoveryError);
      
      // Mark agent as unavailable
      agent.setStatus('unavailable');
      
      // Notify operations team
      await this.notifyOperationsTeam({
        severity: 'high',
        issue: 'agent_failure',
        agent_id: agentId,
        error: error.message,
        recovery_failed: true
      });
    }
  }
  
  private async runStrategyTournament(params: any): Promise<any> {
    // Implementation connects to tournament engine
    return await this.mcpClient.callApp('ai-coo', 'run_tournament', params);
  }
  
  private async adjustAllocationsForRisk(allocations: any, constraints: any): Promise<any> {
    // Adjust allocations to meet risk constraints
    const adjusted = { ...allocations };
    
    // Apply constraints
    if (constraints.max_position_size) {
      Object.keys(adjusted).forEach(key => {
        adjusted[key] = Math.min(adjusted[key], constraints.max_position_size);
      });
    }
    
    // Renormalize
    const total = Object.values(adjusted).reduce((sum: number, val: any) => sum + (val as number), 0);
    Object.keys(adjusted).forEach(key => {
      adjusted[key] = (adjusted[key] as number) / total;
    });
    
    return adjusted;
  }
  
  private async getCurrentSystemState(): Promise<any> {
    const [portfolio, market, positions, alerts] = await Promise.all([
      this.mcpClient.getContext('portfolio'),
      this.mcpClient.getContext('market'),
      this.mcpClient.callApp('trade-runner', 'get_positions'),
      this.mcpClient.callApp('ops-console', 'get_alerts', { status: 'active' })
    ]);
    
    return {
      portfolio,
      market,
      positions,
      active_alerts: alerts.alerts,
      timestamp: new Date()
    };
  }
  
  private async executeImmediateActions(trigger: string, severity: string): Promise<any> {
    const actions: any[] = [];
    
    if (severity === 'critical') {
      // Stop all trading
      const stopResult = await this.mcpClient.callApp('trade-runner', 'emergency_stop', {
        reason: `Emergency response: ${trigger}`
      });
      actions.push({ action: 'stop_trading', result: stopResult });
      
      // Pause non-critical agents
      const pausedAgents = await this.pauseNonCriticalAgents();
      actions.push({ action: 'pause_agents', result: pausedAgents });
    }
    
    if (severity === 'high' || severity === 'critical') {
      // Increase monitoring frequency
      await this.increaseMonitoringFrequency();
      actions.push({ action: 'increase_monitoring', result: { frequency: '1m' } });
      
      // Notify key personnel
      await this.notifyKeyPersonnel(trigger, severity);
      actions.push({ action: 'notify_personnel', result: { notified: true } });
    }
    
    return actions;
  }
  
  private async determineResponseStrategy(trigger: string, riskAssessment: any): Promise<any> {
    // Use AI to determine best response strategy
    const strategy = await this.agents.get('market_analyst')!.determineResponseStrategy({
      trigger,
      risk_assessment: riskAssessment,
      available_actions: this.getAvailableActions()
    });
    
    return strategy;
  }
  
  private async executeResponseStrategy(strategy: any): Promise<any> {
    const results = {
      actions_executed: [] as any[],
      success: true,
      errors: [] as any[]
    };
    
    for (const action of strategy.actions) {
      try {
        const result = await this.executeStrategicAction(action);
        results.actions_executed.push({
          action: action.type,
          result,
          success: true
        });
      } catch (error) {
        results.errors.push({
          action: action.type,
          error: (error as Error).message
        });
        results.success = false;
      }
    }
    
    return results;
  }
  
  private async generatePostIncidentRecommendations(): Promise<any[]> {
    const recommendations: any[] = [];
    
    // Analyze what happened
    const analysis = await this.agents.get('performance_analyst')!.analyzeIncident({
      workflow_history: this.getWorkflowHistory()
    });
    
    // Generate recommendations
    if (analysis.root_cause) {
      recommendations.push({
        type: 'process_improvement',
        description: `Address root cause: ${analysis.root_cause}`,
        priority: 'high'
      });
    }
    
    if (analysis.system_vulnerabilities) {
      recommendations.push({
        type: 'system_hardening',
        description: 'Implement additional safeguards',
        details: analysis.system_vulnerabilities,
        priority: 'medium'
      });
    }
    
    return recommendations;
  }
  
  private isCriticalStep(stepName: string): boolean {
    const criticalSteps = ['risk_check', 'compliance_check', 'execution_planning'];
    return criticalSteps.includes(stepName);
  }
  
  private async synthesizeEvaluations(evaluations: any[]): Promise<any> {
    // Combine and weight different evaluation perspectives
    const synthesis: any = {};
    
    evaluations.forEach((evaluation) => {
      Object.entries(evaluation).forEach(([key, value]) => {
        if (!synthesis[key]) {
          synthesis[key] = [] as any[];
        }
        (synthesis[key] as any[]).push(value);
      });
    });
    
    // Average or intelligently combine
    Object.keys(synthesis).forEach(key => {
      const values = synthesis[key];
      if (typeof values[0] === 'number') {
        synthesis[key] = (values as number[]).reduce((a, b) => a + b, 0) / values.length;
      } else {
        synthesis[key] = values; // Keep as array for non-numeric values
      }
    });
    
    return synthesis;
  }
  
  private async handleCriticalRisks(risks: any[]) {
    for (const risk of risks) {
      // Create alert
      await this.mcpClient.streamData('risk:critical', {
        risk,
        timestamp: new Date()
      });
      
      // Take immediate action based on risk type
      switch (risk.type) {
        case 'position_concentration':
          await this.agents.get('execution')!.reducePosition({
            position: risk.position,
            target_reduction: risk.recommended_reduction
          });
          break;
          
        case 'correlation_spike':
          await this.agents.get('risk_monitor')!.hedgeCorrelationRisk({
            assets: risk.correlated_assets
          });
          break;
          
        case 'liquidity_shortage':
          await this.agents.get('execution')!.improveLiquidity({
            required_liquidity: risk.required_amount
          });
          break;
      }
    }
  }
  
  private async storeWorkflowResults(workflow: any) {
    await this.mcpClient.callApp('data-hub', 'store_workflow', {
      workflow_id: workflow.id,
      type: workflow.type,
      status: workflow.status,
      results: workflow.results,
      duration: (workflow.completed_at as Date).getTime() - (workflow.started_at as Date).getTime()
    });
  }
  
  private async handleWorkflowFailure(workflow: any, error: any) {
    // Log failure
    await this.mcpClient.streamData('workflow:failed', {
      workflow_id: workflow.id,
      type: workflow.type,
      error: (error as Error).message,
      timestamp: new Date()
    });
    
    // Attempt recovery based on workflow type
    if (workflow.type === 'daily_operations') {
      // Try to complete critical steps manually
      await this.completeCriticalStepsManually(workflow);
    }
    
    // Notify team
    await this.notifyOperationsTeam({
      severity: 'high',
      issue: 'workflow_failure',
      workflow_id: workflow.id,
      error: (error as Error).message
    });
  }
  
  private async generateReportVisualizations(report: any): Promise<any[]> {
    const visualizations: any[] = [];
    
    // Performance charts
    if (report.performance_data) {
      visualizations.push(await this.createPerformanceChart(report.performance_data));
    }
    
    // Risk heatmap
    if (report.risk_data) {
      visualizations.push(await this.createRiskHeatmap(report.risk_data));
    }
    
    // Strategy allocation pie chart
    if (report.allocation_data) {
      visualizations.push(await this.createAllocationChart(report.allocation_data));
    }
    
    return visualizations;
  }
  
  private async distributeReport(report: any, visualizations: any[], recipients: string[]) {
    await this.mcpClient.callApp('investor-portal', 'send_report', {
      report,
      visualizations,
      recipients,
      delivery_method: 'email'
    });
  }
  
  private async pauseNonCriticalAgents(): Promise<string[]> {
    const nonCritical = ['reporting', 'performance_analyst'];
    const paused: string[] = [];
    
    for (const agentId of nonCritical) {
      const agent = this.agents.get(agentId);
      if (agent) {
        await agent.pause();
        paused.push(agentId);
      }
    }
    
    return paused;
  }
  
  private async increaseMonitoringFrequency() {
    await this.mcpClient.callApp('ops-console', 'update_config', {
      monitoring_interval: 60, // 1 minute
      alert_threshold_multiplier: 0.8 // More sensitive
    });
  }
  
  private async notifyKeyPersonnel(trigger: string, severity: string) {
    await this.mcpClient.callApp('ops-console', 'send_alert', {
      type: 'emergency',
      trigger,
      severity,
      recipients: ['cto@fieldelevate.com', 'risk@fieldelevate.com'],
      require_acknowledgment: true
    });
  }
  
  private async notifyOperationsTeam(alert: any) {
    await this.mcpClient.callApp('ops-console', 'create_alert', alert);
  }
  
  private getAvailableActions(): string[] {
    return [
      'stop_trading',
      'reduce_positions',
      'hedge_portfolio',
      'increase_cash',
      'pause_strategies',
      'emergency_liquidation'
    ];
  }
  
  private async executeStrategicAction(action: any): Promise<any> {
    switch (action.type) {
      case 'reduce_positions':
        return await this.agents.get('execution')!.reduceAllPositions({
          target_reduction: action.params.percentage
        });
        
      case 'hedge_portfolio':
        return await this.agents.get('execution')!.hedgePortfolio({
          hedge_type: action.params.hedge_type
        });
        
      case 'increase_cash':
        return await this.agents.get('execution')!.increaseCashPosition({
          target_cash_percentage: action.params.target
        });
        
      default:
        throw new Error(`Unknown strategic action: ${action.type}`);
    }
  }
  
  private getWorkflowHistory(): any[] {
    // Return recent workflow history for analysis
    return Array.from(this.activeWorkflows.values());
  }
  
  private async completeCriticalStepsManually(workflow: any) {
    const criticalSteps = ['risk_check', 'compliance_check'];
    
    for (const stepName of criticalSteps) {
      const step = workflow.steps.find((s: any) => s.name === stepName);
      if (!step || step.status !== 'completed') {
        try {
          // Attempt to complete the step
          const agent = this.getAgentForStep(stepName);
          await agent.execute({
            action: stepName,
            context: { workflow_id: workflow.id, manual_completion: true }
          });
        } catch (error) {
          console.error(`Failed to complete critical step ${stepName}:`, error);
        }
      }
    }
  }
  
  private getAgentForStep(stepName: string): BaseAgent {
    const stepAgentMap: Record<string, string> = {
      'risk_check': 'risk_monitor',
      'compliance_check': 'compliance',
      'market_analysis': 'market_analyst'
    };
    
    return this.agents.get(stepAgentMap[stepName]) || this.agents.get('reporting')!;
  }
  
  private async createPerformanceChart(data: any): Promise<any> {
    return {
      type: 'line_chart',
      data: data,
      config: {
        title: 'Portfolio Performance',
        xAxis: 'Date',
        yAxis: 'Returns %'
      }
    };
  }
  
  private async createRiskHeatmap(data: any): Promise<any> {
    return {
      type: 'heatmap',
      data: data,
      config: {
        title: 'Risk Factor Heatmap',
        colorScale: 'risk'
      }
    };
  }
  
  private async createAllocationChart(data: any): Promise<any> {
    return {
      type: 'pie_chart',
      data: data,
      config: {
        title: 'Strategy Allocation',
        showPercentages: true
      }
    };
  }
}
