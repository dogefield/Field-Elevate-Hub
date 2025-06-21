# Field Elevate Trading System - Overview

## System Architecture

Field Elevate is a sophisticated AI-powered trading system designed to achieve a 65% win rate through intelligent decision-making and rigorous risk management.

## Running Services

### Infrastructure
1. **PostgreSQL Database** (Port 5433)
   - TimescaleDB for time-series data
   - Stores trades, historical data, and analytics

2. **Redis Cache** (Port 6380)
   - High-performance caching
   - Real-time data streaming
   - Pub/sub messaging

3. **Prometheus** (Port 9090)
   - Metrics collection
   - System monitoring

4. **Grafana** (Port 3000)
   - Data visualization
   - Custom dashboards

### Core Services

1. **MCP Hub** (Port 8000)
   - Central service orchestrator
   - Service registry and health monitoring
   - Inter-service communication
   - Status: ✅ Running

2. **Data Hub** (Port 8001)
   - Market data ingestion
   - Real-time quotes and bars
   - Technical indicators calculation
   - News sentiment analysis
   - Status: ✅ Running

3. **AI COO** (Port 8002)
   - Claude-powered decision making
   - Strategic analysis
   - Trade opportunity evaluation
   - Market insights generation
   - Status: ✅ Running

4. **Risk Analyzer** (Port 8004)
   - Portfolio risk assessment
   - Position sizing validation
   - VaR calculations
   - Stress testing
   - Status: ✅ Running

5. **API Gateway** (Port 3001)
   - Unified API endpoint
   - Request routing
   - Service aggregation
   - Status: ⏳ Ready to start

## Key Features Implemented

### Data Hub
- Real-time market data fetching (mock data for development)
- Historical bars retrieval
- Technical indicators (SMA, RSI)
- News sentiment analysis
- Caching with Redis

### Risk Analyzer
- Portfolio management
- Position risk calculations
- Portfolio-wide risk metrics
- Stress test scenarios
- Real-time monitoring
- Risk limit enforcement

### AI COO
- Market analysis using Claude
- Trading decision evaluation
- Strategy generation
- Performance insights
- Coordinated decision-making

### MCP Hub
- Service health monitoring
- Context management
- Event broadcasting
- Tool execution

## API Endpoints

### Data Hub (8001)
- `GET /api/market/quote/:symbol` - Get real-time quote
- `GET /api/market/bars/:symbol` - Get historical bars
- `POST /api/market/snapshot` - Get multi-symbol snapshot
- `GET /api/market/technicals/:symbol` - Get technical indicators
- `GET /api/news/:symbol` - Get news and sentiment

### Risk Analyzer (8004)
- `GET /api/portfolio` - Current portfolio status
- `POST /api/risk/check` - Check risk limits
- `POST /api/risk/evaluate` - Evaluate new trade
- `GET /api/risk/report` - Generate risk report
- `POST /api/stress/test` - Run stress tests

### AI COO (8002)
- `POST /api/analyze` - Analyze market conditions
- `POST /api/decision` - Make trading decision
- `POST /api/strategy` - Generate trading strategy
- `GET /api/insights` - Get market insights

### MCP Hub (8000)
- `GET /api/services` - List registered services
- `GET /api/context/:type` - Get context data
- `POST /api/execute/:tool` - Execute MCP tools

## Environment Configuration

Key environment variables in `.env`:
- Database credentials
- Redis connection
- API keys (Anthropic, market data providers)
- Service ports and URLs

## Next Steps

1. **Frontend Integration** 
   - Connect React components to API Gateway
   - Real-time updates via WebSocket
   - Interactive dashboards

2. **Trade Validation Center**
   - Implement Bull/Bear/Judge debate system
   - Multi-personality validation

3. **Production Deployment**
   - Docker containerization
   - Kubernetes orchestration
   - SSL/TLS configuration

4. **Enhanced Features**
   - Real market data integration
   - Backtesting framework
   - Performance analytics
   - Automated trading execution

## Quick Start

1. Ensure Docker is running
2. Services are already started
3. Access service status: Open `service-status.html` in browser
4. View Grafana dashboards: http://localhost:3000 (admin/admin)

## Testing the System

```bash
# Check all services
curl http://localhost:8000/health  # MCP Hub
curl http://localhost:8001/health  # Data Hub
curl http://localhost:8002/health  # AI COO
curl http://localhost:8004/health  # Risk Analyzer

# Get market data
curl http://localhost:8001/api/market/quote/AAPL

# Check portfolio
curl http://localhost:8004/api/portfolio

# Get AI analysis
curl -X POST http://localhost:8002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["AAPL", "GOOGL"]}'
```

## Architecture Benefits

1. **Microservices**: Each component is independently scalable
2. **AI-Driven**: Claude provides intelligent decision-making
3. **Risk-First**: Every trade validated against risk limits
4. **Real-Time**: Low-latency data processing
5. **Observable**: Comprehensive monitoring and logging

The system is now ready for frontend integration and further enhancement!