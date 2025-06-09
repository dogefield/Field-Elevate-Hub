import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';

export class RealTimeAnalyticsEngine extends EventEmitter {
  private wsConnections: Map<string, WebSocket> = new Map();
  private metricsBuffer: Map<string, any[]> = new Map();
  private aggregators: Map<string, AggregatorFunction> = new Map();
  
  constructor(private mcpClient: any) {
    super();
    this.initializeAggregators();
  }
  
  private initializeAggregators() {
    // Portfolio metrics aggregator
    this.aggregators.set('portfolio', (data: any[]) => {
      const latest = data[data.length - 1];
      const previous = data[0];
      
      return {
        current_value: latest.value,
        change_amount: latest.value - previous.value,
        change_percent: ((latest.value - previous.value) / previous.value) * 100,
        high_24h: Math.max(...data.map(d => d.value)),
        low_24h: Math.min(...data.map(d => d.value)),
        positions: latest.positions
      };
    });
    
    // Performance aggregator
    this.aggregators.set('performance', (data: any[]) => {
      const returns = data.map((d, i) => 
        i > 0 ? (d.value - data[i-1].value) / data[i-1].value : 0
      ).filter(r => r !== 0);
      
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const sharpe = mean / Math.sqrt(variance) * Math.sqrt(252); // Annualized
      
      return {
        total_return: (data[data.length - 1].value - data[0].value) / data[0].value,
        volatility: Math.sqrt(variance) * Math.sqrt(252),
        sharpe_ratio: sharpe,
        max_drawdown: this.calculateMaxDrawdown(data),
        win_rate: returns.filter(r => r > 0).length / returns.length
      };
    });
    
    // Risk metrics aggregator
    this.aggregators.set('risk', (data: any[]) => {
      const values = data.map(d => d.portfolio_value);
      const returns = values.map((v, i) => 
        i > 0 ? (v - values[i-1]) / values[i-1] : 0
      ).filter(r => r !== 0);
      
      // Calculate VaR
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const var95Index = Math.floor(sortedReturns.length * 0.05);
      const var95 = sortedReturns[var95Index] * values[values.length - 1];
      
      return {
        var_95: Math.abs(var95),
        current_exposure: data[data.length - 1].total_exposure,
        leverage: data[data.length - 1].leverage,
        largest_position: data[data.length - 1].largest_position,
        concentration_risk: this.calculateConcentrationRisk(data[data.length - 1].positions)
      };
    });
    
    // Trade execution aggregator
    this.aggregators.set('execution', (data: any[]) => {
      const trades = data.filter(d => d.type === 'trade');
      const orders = data.filter(d => d.type === 'order');
      
      return {
        trades_count: trades.length,
        orders_count: orders.length,
        total_volume: trades.reduce((sum, t) => sum + t.volume, 0),
        avg_slippage: trades.reduce((sum, t) => sum + (t.slippage || 0), 0) / trades.length,
        fill_rate: trades.length / orders.length,
        avg_execution_time: trades.reduce((sum, t) => sum + t.execution_time, 0) / trades.length
      };
    });
  }
  
  async startStreaming() {
    // Subscribe to real-time data streams
    await this.subscribeToDataStreams();
    
    // Start aggregation intervals
    this.startAggregationIntervals();
    
    // Initialize WebSocket server for clients
    this.initializeWebSocketServer();
  }
  
  private async subscribeToDataStreams() {
    // Subscribe to portfolio updates
    this.mcpClient.on('portfolio:updated', (data: any) => {
      this.bufferData('portfolio', data);
      this.emit('portfolio:update', data);
    });
    
    // Subscribe to trade executions
    this.mcpClient.on('trade:executed', (data: any) => {
      this.bufferData('execution', { ...data, type: 'trade' });
      this.emit('trade:executed', data);
    });
    
    // Subscribe to risk updates
    this.mcpClient.on('risk:updated', (data: any) => {
      this.bufferData('risk', data);
      this.emit('risk:update', data);
    });
    
    // Subscribe to strategy performance
    this.mcpClient.on('strategy:performance', (data: any) => {
      this.bufferData('performance', data);
      this.emit('strategy:performance', data);
    });
  }
  
  private bufferData(metric: string, data: any) {
    if (!this.metricsBuffer.has(metric)) {
      this.metricsBuffer.set(metric, []);
    }
    
    const buffer = this.metricsBuffer.get(metric)!;
    buffer.push({ ...data, timestamp: new Date() });
    
    // Keep only last 24 hours of data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = buffer.filter(d => d.timestamp > cutoff);
    this.metricsBuffer.set(metric, filtered);
  }
  
  private startAggregationIntervals() {
    // 1-second aggregation for real-time updates
    setInterval(() => {
      this.aggregateAndBroadcast(['portfolio', 'execution'], '1s');
    }, 1000);
    
    // 1-minute aggregation for performance metrics
    setInterval(() => {
      this.aggregateAndBroadcast(['performance', 'risk'], '1m');
    }, 60000);
    
    // 5-minute aggregation for deeper analysis
    setInterval(() => {
      this.performDeepAnalysis();
    }, 300000);
  }
  
  private aggregateAndBroadcast(metrics: string[], interval: string) {
    const aggregated: any = { interval, timestamp: new Date() };
    
    for (const metric of metrics) {
      const aggregator = this.aggregators.get(metric);
      const data = this.metricsBuffer.get(metric);
      
      if (aggregator && data && data.length > 0) {
        aggregated[metric] = aggregator(data);
      }
    }
    
    // Broadcast to connected clients
    this.broadcast('analytics:update', aggregated);
  }
  
  private async performDeepAnalysis() {
    // Correlation analysis
    const correlations = await this.calculateCorrelations();
    
    // Anomaly detection
    const anomalies = await this.detectAnomalies();
    
    // Performance attribution
    const attribution = await this.calculateAttribution();
    
    const analysis = {
      timestamp: new Date(),
      correlations,
      anomalies,
      attribution,
      insights: await this.generateInsights({ correlations, anomalies, attribution })
    };
    
    this.broadcast('analytics:deep_analysis', analysis);
    
    // Store for historical analysis
    await this.mcpClient.callApp('data-hub', 'store_analysis', analysis);
  }
  
  private async calculateCorrelations(): Promise<any> {
    const positions = await this.mcpClient.callApp('trade-runner', 'get_positions');
    const priceData = await this.mcpClient.callApp('data-hub', 'get_price_history', {
      assets: positions.positions.map((p: any) => p.asset),
      timeframe: '24h'
    });
    
    const correlationMatrix: any = {};
    
    // Calculate pairwise correlations
    const assets = Object.keys(priceData);
    for (let i = 0; i < assets.length; i++) {
      correlationMatrix[assets[i]] = {};
      for (let j = 0; j < assets.length; j++) {
        if (i === j) {
          correlationMatrix[assets[i]][assets[j]] = 1;
        } else {
          correlationMatrix[assets[i]][assets[j]] = this.calculateCorrelation(
            priceData[assets[i]],
            priceData[assets[j]]
          );
        }
      }
    }
    
    return {
      matrix: correlationMatrix,
      high_correlations: this.findHighCorrelations(correlationMatrix),
      portfolio_correlation: this.calculatePortfolioCorrelation(correlationMatrix, positions)
    };
  }
  
  private calculateCorrelation(series1: number[], series2: number[]): number {
    const n = Math.min(series1.length, series2.length);
    if (n < 2) return 0;
    
    const mean1 = series1.reduce((a, b) => a + b) / n;
    const mean2 = series2.reduce((a, b) => a + b) / n;
    
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  private findHighCorrelations(matrix: any): any[] {
    const highCorrelations = [] as any[];
    const threshold = 0.7;
    
    const assets = Object.keys(matrix);
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const correlation = matrix[assets[i]][assets[j]];
        if (Math.abs(correlation) > threshold) {
          highCorrelations.push({
            asset1: assets[i],
            asset2: assets[j],
            correlation,
            risk_level: Math.abs(correlation) > 0.9 ? 'high' : 'medium'
          });
        }
      }
    }
    
    return highCorrelations;
  }
  
  private calculatePortfolioCorrelation(matrix: any, positions: any): number {
    // Calculate weighted average correlation
    let totalCorrelation = 0;
    let totalWeight = 0;
    
    const positionMap = new Map(
      positions.positions.map((p: any) => [p.asset, p.value / positions.total_value])
    );
    
    for (const [asset1, weight1] of positionMap) {
      for (const [asset2, weight2] of positionMap) {
        if (asset1 !== asset2) {
          const correlation = matrix[asset1]?.[asset2] || 0;
          totalCorrelation += correlation * weight1 * weight2;
          totalWeight += weight1 * weight2;
        }
      }
    }
    
    return totalWeight > 0 ? totalCorrelation / totalWeight : 0;
  }
  
  private async detectAnomalies(): Promise<any[]> {
    const anomalies = [] as any[];
    
    // Check each metric buffer for anomalies
    for (const [metric, data] of this.metricsBuffer) {
      if (data.length < 10) continue;
      
      // Calculate statistics
      const values = data.map(d => d.value || d.portfolio_value || 0);
      const mean = values.reduce((a, b) => a + b) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      );
      
      // Check latest value
      const latest = values[values.length - 1];
      const zScore = (latest - mean) / stdDev;
      
      if (Math.abs(zScore) > 3) {
        anomalies.push({
          metric,
          value: latest,
          z_score: zScore,
          severity: Math.abs(zScore) > 4 ? 'high' : 'medium',
          direction: zScore > 0 ? 'spike' : 'drop',
          timestamp: data[data.length - 1].timestamp
        });
      }
    }
    
    return anomalies;
  }
  
  private async calculateAttribution(): Promise<any> {
    const performance = await this.mcpClient.callApp('signal-forge', 'get_strategy_performance', {
      timeframe: '24h'
    });
    
    const portfolioReturn = this.metricsBuffer.get('portfolio')?.slice(-2);
    if (!portfolioReturn || portfolioReturn.length < 2) {
      return { strategies: [], factors: [] };
    }
    
    const totalReturn = (portfolioReturn[1].value - portfolioReturn[0].value) / portfolioReturn[0].value;
    
    // Attribution by strategy
    const strategyAttribution = performance.strategies.map((s: any) => ({
      strategy_id: s.id,
      strategy_name: s.name,
      contribution: s.return * s.allocation,
      allocation: s.allocation,
      return: s.return
    }));
    
    // Factor attribution (simplified)
    const factorAttribution = [
      { factor: 'selection', contribution: totalReturn * 0.6 },
      { factor: 'allocation', contribution: totalReturn * 0.3 },
      { factor: 'interaction', contribution: totalReturn * 0.1 }
    ];
    
    return {
      total_return: totalReturn,
      strategies: strategyAttribution,
      factors: factorAttribution
    };
  }
  
  private async generateInsights(analysis: any): Promise<string[]> {
    const insights: string[] = [];
    
    // Correlation insights
    if (analysis.correlations.high_correlations.length > 0) {
      insights.push(
        `High correlation detected between ${analysis.correlations.high_correlations.length} asset pairs. ` +
        `Consider diversification to reduce risk.`
      );
    }
    
    // Anomaly insights
    if (analysis.anomalies.length > 0) {
      const critical = analysis.anomalies.filter((a: any) => a.severity === 'high');
      if (critical.length > 0) {
        insights.push(
          `Critical anomaly detected in ${critical[0].metric}: ` +
          `${critical[0].direction} of ${Math.abs(critical[0].z_score).toFixed(1)} standard deviations.`
        );
      }
    }
    
    // Attribution insights
    if (analysis.attribution.strategies.length > 0) {
      const topContributor = analysis.attribution.strategies
        .sort((a: any, b: any) => b.contribution - a.contribution)[0];
      
      insights.push(
        `Top performing strategy: ${topContributor.strategy_name} ` +
        `contributing ${(topContributor.contribution * 100).toFixed(2)}% to portfolio returns.`
      );
    }
    
    return insights;
  }
  
  private calculateMaxDrawdown(data: any[]): number {
    const values = data.map(d => d.value || d.portfolio_value);
    let maxDrawdown = 0;
    let peak = values[0];
    
    for (const value of values) {
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
  
  private calculateConcentrationRisk(positions: any[]): number {
    if (!positions || positions.length === 0) return 0;
    
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const weights = positions.map(p => p.value / totalValue);
    
    // Herfindahl-Hirschman Index
    return weights.reduce((sum, w) => sum + w * w, 0);
  }
  
  private initializeWebSocketServer() {
    const wss = new WebSocketServer({ port: 8080 });
    
    wss.on('connection', (ws: WebSocket) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      this.wsConnections.set(clientId, ws);
      
      // Send initial data
      this.sendInitialData(ws);
      
      ws.on('message', (message: string) => {
        this.handleClientMessage(clientId, JSON.parse(message));
      });
      
      ws.on('close', () => {
        this.wsConnections.delete(clientId);
      });
    });
  }
  
  private sendInitialData(ws: WebSocket) {
    // Send current state of all metrics
    const initialData: any = { type: 'initial_data', timestamp: new Date() };
    
    for (const [metric, data] of this.metricsBuffer) {
      if (data.length > 0) {
        const aggregator = this.aggregators.get(metric);
        if (aggregator) {
          initialData[metric] = aggregator(data);
        }
      }
    }
    
    ws.send(JSON.stringify(initialData));
  }
  
  private handleClientMessage(clientId: string, message: any) {
    const ws = this.wsConnections.get(clientId);
    if (!ws) return;
    
    switch (message.type) {
      case 'subscribe':
        // Client subscribing to specific metrics
        // Implement subscription logic
        break;
        
      case 'unsubscribe':
        // Client unsubscribing from metrics
        // Implement unsubscription logic
        break;
        
      case 'query':
        // Client requesting historical data
        this.handleQuery(ws, message.query);
        break;
    }
  }
  
  private async handleQuery(ws: WebSocket, query: any) {
    try {
      const result = await this.mcpClient.callApp('data-hub', 'query', query);
      ws.send(JSON.stringify({
        type: 'query_result',
        query_id: query.id,
        result
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'query_error',
        query_id: query.id,
        error: (error as Error).message
      }));
    }
  }
  
  private broadcast(type: string, data: any) {
    const message = JSON.stringify({ type, data, timestamp: new Date() });
    
    for (const [clientId, ws] of this.wsConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        // Clean up disconnected clients
        this.wsConnections.delete(clientId);
      }
    }
  }
}

type AggregatorFunction = (data: any[]) => any;
