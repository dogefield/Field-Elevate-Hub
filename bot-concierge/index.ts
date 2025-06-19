import express from 'express';
import { setupMCPClient, createMCPHandler } from '../shared/mcp/mcp-client';
import { ConversationManager } from './utils/conversation-manager';
import { QueryProcessor } from './utils/query-processor';
import { ResponseGenerator } from './utils/response-generator';

const app = express();
app.use(express.json());

// Initialize components
const conversationManager = new ConversationManager();
const queryProcessor = new QueryProcessor();
const responseGenerator = new ResponseGenerator();

// Initialize MCP client
const mcpClient = setupMCPClient({
  appId: 'bot-concierge',
  appName: 'Bot Concierge',
  capabilities: ['chat', 'query_processing', 'code_interpreter', 'visualization']
});

// Connect to hub and expose methods
mcpClient.connect().then(() => {
  // Process chat query
  mcpClient.exposeMethod('process_query', async (params: any, callback: Function) => {
    try {
      const { user_id, message, conversation_id, context = {} } = params;
      
      // Get or create conversation
      const conversation = conversationManager.getOrCreate(conversation_id || `conv_${user_id}_${Date.now()}`);
      
      // Add user message
      conversation.addMessage({
        role: 'user',
        content: message,
        timestamp: new Date()
      });
      
      // Process query to understand intent
      const intent = await queryProcessor.analyze(message);
      
      // Route based on intent
      let response;
      switch (intent.category) {
        case 'portfolio_query':
          response = await handlePortfolioQuery(intent, context);
          break;
          
        case 'strategy_query':
          response = await handleStrategyQuery(intent, context);
          break;
          
        case 'market_analysis':
          response = await handleMarketAnalysis(intent, context);
          break;
          
        case 'performance_query':
          response = await handlePerformanceQuery(intent, context);
          break;
          
        case 'risk_query':
          response = await handleRiskQuery(intent, context);
          break;
          
        case 'code_generation':
          response = await handleCodeGeneration(intent, context);
          break;
          
        case 'visualization':
          response = await handleVisualization(intent, context);
          break;
          
        default:
          response = await handleGeneralQuery(intent, context);
      }
      
      // Add assistant response
      conversation.addMessage({
        role: 'assistant',
        content: response.text,
        data: response.data,
        visualizations: response.visualizations,
        timestamp: new Date()
      });
      
      // Update context for future queries
      await mcpClient.updateContext('conversation', {
        conversation_id: conversation.id,
        last_intent: intent,
        last_response: response.summary
      });
      
      callback(null, {
        success: true,
        response: response.text,
        data: response.data,
        visualizations: response.visualizations,
        conversation_id: conversation.id,
        suggested_actions: response.suggested_actions
      });
      
    } catch (error) {
      callback(error);
    }
  });

  // Generate code interpreter response
  mcpClient.exposeMethod('generate_code', async (params: any, callback: Function) => {
    try {
      const { request, language = 'python', context = {} } = params;
      
      // Get relevant context
      const portfolioContext = await mcpClient.getContext('portfolio');
      const strategyContext = await mcpClient.getContext('strategy');
      
      // Generate code based on request
      const code = await generateCode({
        request,
        language,
        context: {
          portfolio: portfolioContext,
          strategies: strategyContext,
          ...context
        }
      });
      
      callback(null, {
        success: true,
        code,
        language,
        explanation: code.explanation,
        dependencies: code.dependencies
      });
      
    } catch (error) {
      callback(error);
    }
  });

  // Create visualization
  mcpClient.exposeMethod('create_visualization', async (params: any, callback: Function) => {
    try {
      const { type, data, options = {} } = params;
      
      const visualization = await createVisualization(type, data, options);
      
      callback(null, {
        success: true,
        visualization_id: visualization.id,
        type: visualization.type,
        config: visualization.config,
        embed_url: visualization.embed_url
      });
      
    } catch (error) {
      callback(error);
    }
  });

  // Get conversation history
  mcpClient.exposeMethod('get_conversation', async (params: any, callback: Function) => {
    try {
      const { conversation_id } = params;
      
      const conversation = conversationManager.get(conversation_id);
      if (!conversation) {
        throw new Error(`Conversation ${conversation_id} not found`);
      }
      
      callback(null, {
        conversation_id,
        messages: conversation.messages,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at
      });
      
    } catch (error) {
      callback(error);
    }
  });

  // Search knowledge base
  mcpClient.exposeMethod('search_knowledge', async (params: any, callback: Function) => {
    try {
      const { query, limit = 10, filters = {} } = params;
      
      // Search across all connected systems
      const [vectorResults, contextResults, historicalResults] = await Promise.all([
        mcpClient.callApp('data-hub', 'vector_search', { query, limit }),
        searchContexts(query),
        searchHistoricalData(query, filters)
      ]);
      
      // Combine and rank results
      const combinedResults = combineSearchResults(
        vectorResults,
        contextResults,
        historicalResults
      );
      
      callback(null, {
        results: combinedResults.slice(0, limit),
        total_found: combinedResults.length,
        sources: ['vector_db', 'contexts', 'historical_data']
      });
      
    } catch (error) {
      callback(error);
    }
  });

  // Health check
  mcpClient.exposeMethod('health', async (_params: any, callback: Function) => {
    callback(null, {
      status: 'healthy',
      uptime: process.uptime(),
      active_conversations: conversationManager.getActiveCount(),
      cache_hit_rate: queryProcessor.getCacheHitRate()
    });
  });
});

// Handle hub requests
app.post('/api/:method', createMCPHandler(mcpClient));

// Query handlers
async function handlePortfolioQuery(intent: any, context: any) {
  const portfolio = await mcpClient.getContext('portfolio');
  const positions = await mcpClient.callApp('trade-runner', 'get_positions');
  
  // Generate natural language response
  const response = responseGenerator.generatePortfolioResponse({
    intent,
    portfolio,
    positions,
    context
  });
  
  // Add relevant visualizations
  const visualizations = [];
  if (intent.requests_chart) {
    const chart = await createVisualization('portfolio_allocation', {
      positions: positions.positions
    });
    visualizations.push(chart);
  }
  
  return {
    text: response.text,
    data: {
      portfolio_value: portfolio.total_value,
      position_count: positions.position_count,
      top_positions: positions.positions.slice(0, 5)
    },
    visualizations,
    suggested_actions: [
      'View detailed performance',
      'Check risk metrics',
      'Rebalance portfolio'
    ]
  };
}

async function handleStrategyQuery(intent: any, context: any) {
  const strategies = await mcpClient.callApp('signal-forge', 'get_strategies', {
    active_only: true
  });
  
  const rankings = await mcpClient.callApp('signal-forge', 'rank_strategies', {
    strategies,
    timeframe: intent.timeframe || '7d'
  });
  
  const response = responseGenerator.generateStrategyResponse({
    intent,
    strategies,
    rankings,
    context
  });
  
  return {
    text: response.text,
    data: {
      active_strategies: strategies.length,
      top_performers: rankings.slice(0, 3),
      recommendations: rankings.filter(r => r.recommendation === 'strong_buy')
    },
    visualizations: [],
    suggested_actions: [
      'Run strategy backtest',
      'View detailed rankings',
      'Create new strategy'
    ]
  };
}

async function handleMarketAnalysis(intent: any, context: any) {
  const marketData = await mcpClient.callApp('data-hub', 'get_market_summary');
  const signals = await mcpClient.callApp('signal-forge', 'analyze_market', {
    marketData
  });
  
  const response = responseGenerator.generateMarketResponse({
    intent,
    marketData,
    signals,
    context
  });
  
  // Create market overview chart
  const chart = await createVisualization('market_overview', {
    assets: marketData.assets,
    timeframe: intent.timeframe || '24h'
  });
  
  return {
    text: response.text,
    data: {
      market_summary: marketData.summary,
      top_movers: marketData.top_movers,
      signal_count: signals.length,
      strongest_signals: signals.slice(0, 3)
    },
    visualizations: [chart],
    suggested_actions: [
      'View detailed signals',
      'Check correlations',
      'Analyze specific asset'
    ]
  };
}

async function handlePerformanceQuery(intent: any, context: any) {
  const timeframe = intent.timeframe || '30d';
  
  const [performance, attribution, comparison] = await Promise.all([
    mcpClient.callApp('investor-portal', 'get_metrics', { timeframe }),
    getPerformanceAttribution(timeframe),
    getBenchmarkComparison(timeframe)
  ]);
  
  const response = responseGenerator.generatePerformanceResponse({
    intent,
    performance,
    attribution,
    comparison,
    context
  });
  
  // Create performance chart
  const chart = await createVisualization('performance_chart', {
    performance_data: performance,
    benchmark_data: comparison,
    timeframe
  });
  
  return {
    text: response.text,
    data: {
      total_return: performance.total_return,
      sharpe_ratio: performance.sharpe_ratio,
      vs_benchmark: comparison.alpha,
      attribution: attribution.top_contributors
    },
    visualizations: [chart],
    suggested_actions: [
      'Download report',
      'View attribution details',
      'Compare to other periods'
    ]
  };
}

async function handleRiskQuery(intent: any, context: any) {
  const portfolio = await mcpClient.getContext('portfolio');
  
  const [riskAnalysis, var95, stressTests] = await Promise.all([
    mcpClient.callApp('risk-analyzer', 'analyze_portfolio', { portfolio }),
    mcpClient.callApp('risk-analyzer', 'calculate_var', { 
      portfolio, 
      confidence_level: 0.95 
    }),
    mcpClient.callApp('risk-analyzer', 'stress_test', { portfolio })
  ]);
  
  const response = responseGenerator.generateRiskResponse({
    intent,
    riskAnalysis,
    var95,
    stressTests,
    context
  });
  
  // Create risk visualization
  const chart = await createVisualization('risk_matrix', {
    risk_factors: riskAnalysis.risk_factors,
    stress_scenarios: stressTests.results
  });
  
  return {
    text: response.text,
    data: {
      risk_score: riskAnalysis.overall_risk_score,
      var_95: var95.var_95,
      largest_risk: riskAnalysis.largest_position,
      worst_scenario: stressTests.worst_case
    },
    visualizations: [chart],
    suggested_actions: [
      'Reduce concentration',
      'Hedge positions',
      'View detailed scenarios'
    ]
  };
}

async function handleCodeGeneration(intent: any, context: any) {
  const code = await generateCode({
    request: intent.code_request,
    language: intent.language || 'python',
    context
  });
  
  return {
    text: `Here's the ${code.language} code for your request:\n\n\`\`\`${code.language}\n${code.content}\n\`\`\`\n\n${code.explanation}`,
    data: {
      code: code.content,
      language: code.language,
      dependencies: code.dependencies
    },
    visualizations: [],
    suggested_actions: [
      'Run code',
      'Modify parameters',
      'Export to file'
    ]
  };
}

async function handleVisualization(intent: any, context: any) {
  // Determine data needed for visualization
  const dataRequirements = analyzeVisualizationRequest(intent);
  
  // Fetch required data
  const data = await fetchVisualizationData(dataRequirements);
  
  // Create visualization
  const viz = await createVisualization(intent.viz_type, data, intent.options);
  
  return {
    text: `I've created a ${intent.viz_type} visualization for you. ${intent.description || ''}`,
    data: {
      visualization_id: viz.id,
      type: viz.type,
      data_points: data.length
    },
    visualizations: [viz],
    suggested_actions: [
      'Export chart',
      'Modify parameters',
      'Create dashboard'
    ]
  };
}

async function handleGeneralQuery(intent: any, context: any) {
  // Use AI to generate response for general queries
  const aiResponse = await mcpClient.callApp('ai-coo', 'generate_response', {
    query: intent.original_query,
    context,
    mode: 'concierge'
  });
  
  return {
    text: aiResponse.response,
    data: aiResponse.data || {},
    visualizations: [],
    suggested_actions: aiResponse.suggested_actions || []
  };
}

// Helper functions
async function generateCode(params: any) {
  const { request, language, context } = params;
  
  // Use AI to generate code
  const codeGen = await mcpClient.callApp('ai-coo', 'generate_code', {
    request,
    language,
    context,
    style: 'functional',
    include_tests: true
  });
  
  return {
    content: codeGen.code,
    language: codeGen.language,
    explanation: codeGen.explanation,
    dependencies: codeGen.dependencies || []
  };
}

async function createVisualization(type: string, data: any, options: any = {}) {
  const vizId = `viz_${Date.now()}`;
  
  // Generate visualization config based on type
  const config = generateVisualizationConfig(type, data, options);
  
  return {
    id: vizId,
    type,
    config,
    embed_url: `/visualizations/${vizId}`,
    created_at: new Date()
  };
}

function generateVisualizationConfig(type: string, data: any, options: any) {
  switch (type) {
    case 'portfolio_allocation':
      return {
        type: 'pie',
        data: {
          labels: data.positions.map((p: any) => p.asset),
          datasets: [{
            data: data.positions.map((p: any) => p.value),
            backgroundColor: generateColors(data.positions.length)
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' },
            title: { display: true, text: 'Portfolio Allocation' }
          }
        }
      };
      
    case 'performance_chart':
      return {
        type: 'line',
        data: {
          labels: data.performance_data.dates,
          datasets: [
            {
              label: 'Portfolio',
              data: data.performance_data.values,
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1
            },
            {
              label: 'Benchmark',
              data: data.benchmark_data.values,
              borderColor: 'rgb(255, 99, 132)',
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Performance Comparison' }
          }
        }
      };
      
    case 'risk_matrix':
      return {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Risk Factors',
            data: data.risk_factors.map((f: any) => ({
              x: f.probability,
              y: f.impact,
              r: f.exposure * 10
            })),
            backgroundColor: 'rgba(255, 99, 132, 0.6)'
          }]
        },
        options: {
          scales: {
            x: { title: { display: true, text: 'Probability' } },
            y: { title: { display: true, text: 'Impact' } }
          }
        }
      };
      
    default:
      return { type: 'bar', data: {}, options: {} };
  }
}

function generateColors(count: number): string[] {
  const colors = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)'
  ];
  
  // Repeat colors if needed
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
}

async function searchContexts(query: string) {
  const contexts = ['market', 'portfolio', 'strategy', 'risk'];
  const results = [];
  
  for (const contextType of contexts) {
    const context = await mcpClient.getContext(contextType);
    if (JSON.stringify(context).toLowerCase().includes(query.toLowerCase())) {
      results.push({
        type: 'context',
        context_type: contextType,
        data: context,
        relevance: 0.8
      });
    }
  }
  
  return results;
}

async function searchHistoricalData(query: string, filters: any) {
  // Search historical data based on query and filters
  return [];
}

function combineSearchResults(...resultSets: any[]) {
  const combined = [];
  
  for (const results of resultSets) {
    combined.push(...results);
  }
  
  // Sort by relevance
  combined.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
  
  return combined;
}

async function getPerformanceAttribution(timeframe: string) {
  // Calculate performance attribution
  return {
    top_contributors: [
      { strategy: 'Momentum Alpha', contribution: 0.023 },
      { strategy: 'Mean Reversion', contribution: 0.015 },
      { strategy: 'Arbitrage', contribution: 0.008 }
    ]
  };
}

async function getBenchmarkComparison(timeframe: string) {
  // Get benchmark comparison data
  return {
    benchmark: 'S&P 500',
    benchmark_return: 0.08,
    portfolio_return: 0.12,
    alpha: 0.04
  };
}

function analyzeVisualizationRequest(intent: any) {
  // Determine what data is needed for the visualization
  return {
    assets: intent.assets || ['BTC', 'ETH'],
    timeframe: intent.timeframe || '30d',
    metrics: intent.metrics || ['price', 'volume']
  };
}

async function fetchVisualizationData(requirements: any) {
  // Fetch data based on requirements
  return await mcpClient.callApp('data-hub', 'get_historical_data', requirements);
}

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Bot Concierge running on port ${PORT}`);
});
