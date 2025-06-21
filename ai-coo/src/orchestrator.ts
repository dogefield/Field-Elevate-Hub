import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const fastify = Fastify({ 
  logger: {
    level: 'info'
  }
});

// Enable CORS
await fastify.register(cors, {
  origin: true
});

// Initialize services
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'your_api_key_here'
});

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6380'
});

redis.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();

// Service URLs
const services = {
  dataHub: process.env.DATA_HUB_URL || 'http://localhost:8001',
  riskAnalyzer: process.env.RISK_ANALYZER_URL || 'http://localhost:8004',
  mcpHub: process.env.MCP_HUB_URL || 'http://localhost:8000'
};

// AI COO System Prompt
const SYSTEM_PROMPT = `You are the AI Chief Operating Officer (COO) for Field Elevate, an advanced trading system. Your role is to:

1. Make high-level strategic decisions about trading opportunities
2. Coordinate between different system components (Data Hub, Risk Analyzer, Trade Validators)
3. Optimize portfolio allocation and risk management
4. Generate actionable insights from market data
5. Ensure all trades align with the goal of achieving 65% win rate

You have access to:
- Real-time market data and technical indicators
- Portfolio status and risk metrics
- Historical performance data
- Current market sentiment

When making decisions:
- Always prioritize risk-adjusted returns
- Consider correlation between positions
- Maintain proper diversification
- Respect position size limits
- Factor in market conditions and volatility

Respond with structured JSON containing your analysis and recommendations.`;

// Health check
fastify.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    service: 'ai-coo',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    redis: redis.isReady ? 'connected' : 'disconnected',
    anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured'
  };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Field Elevate AI COO',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      analyze: '/api/analyze',
      decision: '/api/decision',
      strategy: '/api/strategy',
      insights: '/api/insights'
    }
  };
});

// Analyze market conditions
fastify.post('/api/analyze', async (request, reply) => {
  const { symbols, timeframe = '1Day' } = request.body as any;
  
  try {
    // Fetch market data
    const marketData = await fetchMarketData(symbols);
    
    // Get current portfolio
    const portfolio = await fetchPortfolio();
    
    // Get risk metrics
    const riskMetrics = await fetchRiskMetrics();
    
    // Prepare context for Claude
    const context = {
      marketData,
      portfolio,
      riskMetrics,
      timestamp: new Date().toISOString()
    };
    
    // Get AI analysis
    const analysis = await getAIAnalysis(context, 'market_analysis');
    
    // Cache the analysis
    await redis.setEx(
      `analysis:${Date.now()}`,
      3600,
      JSON.stringify(analysis)
    );
    
    return analysis;
  } catch (error: any) {
    console.error('Analysis error:', error);
    return reply.code(500).send({ error: error.message });
  }
});

// Make trading decision
fastify.post('/api/decision', async (request, reply) => {
  const { opportunity, context } = request.body as any;
  
  try {
    // Validate opportunity with risk analyzer
    const riskCheck: any = await validateWithRisk(opportunity);
    
    if (!riskCheck.approved) {
      return {
        decision: 'REJECT',
        reason: riskCheck.reason,
        suggestions: riskCheck.suggestions
      };
    }
    
    // Get AI decision
    const decision = await getAIDecision(opportunity, context);
    
    // Log decision
    await logDecision(decision);
    
    return decision;
  } catch (error: any) {
    console.error('Decision error:', error);
    return reply.code(500).send({ error: error.message });
  }
});

// Generate trading strategy
fastify.post('/api/strategy', async (request, reply) => {
  const { goals, constraints, timeHorizon } = request.body as any;
  
  try {
    // Get comprehensive market overview
    const marketOverview = await getMarketOverview();
    
    // Generate strategy using AI
    const strategy = await generateStrategy({
      goals,
      constraints,
      timeHorizon,
      marketOverview
    });
    
    // Validate strategy feasibility
    const validation = await validateStrategy(strategy);
    
    return {
      strategy,
      validation,
      confidence: calculateConfidence(strategy, validation)
    };
  } catch (error: any) {
    console.error('Strategy error:', error);
    return reply.code(500).send({ error: error.message });
  }
});

// Get market insights
fastify.get('/api/insights', async (request, reply) => {
  try {
    // Gather various data points
    const recentTrades = await getRecentTrades();
    const performance = await getPerformanceMetrics();
    const marketConditions = await getMarketConditions();
    
    // Generate insights using AI
    const insights = await generateInsights({
      recentTrades,
      performance,
      marketConditions
    });
    
    return insights;
  } catch (error: any) {
    console.error('Insights error:', error);
    return reply.code(500).send({ error: error.message });
  }
});

// Helper functions
async function fetchMarketData(symbols: string[]) {
  try {
    const response = await fetch(`${services.dataHub}/api/market/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols })
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    return {};
  }
}

async function fetchPortfolio() {
  try {
    const response = await fetch(`${services.riskAnalyzer}/api/portfolio`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return { positions: [], totalValue: 0 };
  }
}

async function fetchRiskMetrics() {
  try {
    const response = await fetch(`${services.riskAnalyzer}/api/risk/metrics`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch risk metrics:', error);
    return {};
  }
}

async function getAIAnalysis(context: any, analysisType: string) {
  const prompt = `Analyze the following market data and provide ${analysisType}:

Context: ${JSON.stringify(context, null, 2)}

Provide a detailed analysis including:
1. Market trends and patterns
2. Risk assessment
3. Opportunities identified
4. Recommended actions
5. Confidence levels

Format your response as JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0].text;
    return JSON.parse(content);
  } catch (error) {
    console.error('AI analysis error:', error);
    // Return mock analysis if Claude fails
    return {
      trends: 'Market showing mixed signals',
      risks: 'Moderate volatility detected',
      opportunities: ['Consider defensive positions'],
      actions: ['Monitor closely', 'Reduce exposure'],
      confidence: 0.6
    };
  }
}

async function getAIDecision(opportunity: any, context: any) {
  const prompt = `Evaluate this trading opportunity and make a decision:

Opportunity: ${JSON.stringify(opportunity, null, 2)}
Context: ${JSON.stringify(context, null, 2)}

Consider:
1. Risk/reward ratio
2. Portfolio fit
3. Market conditions
4. Win rate impact

Respond with a JSON decision including:
- action: "APPROVE" or "REJECT"
- confidence: 0-1
- reasoning: detailed explanation
- modifications: any suggested changes`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      temperature: 0.5,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0].text;
    return JSON.parse(content);
  } catch (error) {
    console.error('AI decision error:', error);
    return {
      action: 'REJECT',
      confidence: 0,
      reasoning: 'Unable to process decision due to error',
      modifications: []
    };
  }
}

async function validateWithRisk(opportunity: any) {
  try {
    const response = await fetch(`${services.riskAnalyzer}/api/risk/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opportunity)
    });
    return await response.json();
  } catch (error) {
    console.error('Risk validation error:', error);
    return { approved: false, reason: 'Risk validation failed' };
  }
}

async function logDecision(decision: any) {
  const key = `decision:${Date.now()}`;
  await redis.setEx(key, 86400 * 30, JSON.stringify({
    ...decision,
    timestamp: new Date().toISOString()
  }));
  
  await redis.xAdd('decisions:stream', '*', {
    action: decision.action,
    confidence: decision.confidence.toString(),
    timestamp: new Date().toISOString()
  });
}

async function generateStrategy(params: any) {
  const prompt = `Generate a comprehensive trading strategy based on:

Goals: ${JSON.stringify(params.goals)}
Constraints: ${JSON.stringify(params.constraints)}
Time Horizon: ${params.timeHorizon}
Market Overview: ${JSON.stringify(params.marketOverview, null, 2)}

Create a strategy that includes:
1. Asset allocation
2. Entry/exit criteria
3. Risk management rules
4. Expected outcomes
5. Implementation timeline

Format as JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 2500,
      temperature: 0.6,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0].text;
    return JSON.parse(content);
  } catch (error) {
    console.error('Strategy generation error:', error);
    return {
      allocation: { stocks: 0.6, bonds: 0.3, cash: 0.1 },
      rules: ['Buy on dips', 'Sell on strength'],
      riskLimits: { maxDrawdown: 0.15, stopLoss: 0.05 },
      expectedReturn: 0.12,
      timeline: '6 months'
    };
  }
}

async function getMarketOverview() {
  // Aggregate data from various sources
  const [marketData, sentiment, technicals] = await Promise.all([
    fetchMarketData(['SPY', 'QQQ', 'DIA', 'IWM']),
    fetch(`${services.dataHub}/api/news/sentiment`).then(r => r.json()),
    fetch(`${services.dataHub}/api/market/technicals/SPY`).then(r => r.json())
  ]);

  return {
    marketData,
    sentiment,
    technicals,
    timestamp: new Date().toISOString()
  };
}

async function validateStrategy(strategy: any) {
  // Mock validation - in production, this would be more sophisticated
  return {
    feasible: true,
    risks: ['Market volatility', 'Execution risk'],
    adjustments: [],
    score: 0.85
  };
}

function calculateConfidence(strategy: any, validation: any) {
  // Simple confidence calculation
  let confidence = validation.score;
  
  // Adjust based on market conditions
  if (strategy.marketVolatility > 0.2) {
    confidence *= 0.9;
  }
  
  return Math.min(0.95, confidence);
}

async function getRecentTrades() {
  const trades = await redis.xRead(
    [{ key: 'trades:executed', id: '-' }],
    { COUNT: 100 }
  );
  
  return trades?.[0]?.messages || [];
}

async function getPerformanceMetrics() {
  // In production, calculate from actual trade history
  return {
    winRate: 0.52,
    avgReturn: 0.08,
    sharpeRatio: 1.2,
    maxDrawdown: 0.12
  };
}

async function getMarketConditions() {
  try {
    const response = await fetch(`${services.dataHub}/api/market/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: ['SPY', 'VIX'] })
    });
    return await response.json();
  } catch (error) {
    return { trend: 'neutral', volatility: 'normal' };
  }
}

async function generateInsights(data: any) {
  const prompt = `Generate actionable insights from:

Recent Trades: ${JSON.stringify(data.recentTrades, null, 2)}
Performance: ${JSON.stringify(data.performance, null, 2)}
Market Conditions: ${JSON.stringify(data.marketConditions, null, 2)}

Provide insights on:
1. What's working well
2. Areas for improvement
3. Market opportunities
4. Risk warnings
5. Recommended adjustments

Format as JSON with actionable recommendations.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1500,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0].text;
    return JSON.parse(content);
  } catch (error) {
    console.error('Insights generation error:', error);
    return {
      strengths: ['Consistent execution'],
      improvements: ['Increase win rate', 'Better timing'],
      opportunities: ['Tech sector rotation'],
      warnings: ['Rising volatility'],
      recommendations: ['Reduce position sizes', 'Focus on quality']
    };
  }
}

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.AI_COO_PORT || '8002');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`AI COO listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await fastify.close();
  if (redis) await redis.quit();
  process.exit(0);
});

start();