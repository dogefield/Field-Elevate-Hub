# Field Elevate Hub - Frontend Setup Guide

## Overview

The Field Elevate Hub frontend is now fully integrated with the backend microservices. The React application communicates with the backend services through the API Gateway running on port 3001.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Docker and Docker Compose (for backend services)
- All backend services running (see below)

## Backend Services Architecture

The system consists of the following microservices:

1. **MCP Hub** (Port 8000) - Central service orchestrator
2. **Data Hub** (Port 8001) - Market data and technical indicators
3. **AI COO** (Port 8002) - AI-powered analysis and insights
4. **Risk Analyzer** (Port 8004) - Portfolio risk management
5. **API Gateway** (Port 3001) - Frontend API proxy and aggregator

## Starting the Complete System

### Step 1: Start Backend Services

```bash
# Navigate to the project root
cd Field-Elevate-Hub

# Start all backend services with Docker
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Step 2: Start the API Gateway

```bash
# Navigate to API Gateway directory
cd api-gateway

# Install dependencies (first time only)
npm install

# Start the API Gateway
npm start
```

The API Gateway should now be running on http://localhost:3001

### Step 3: Start the Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start the React development server
npm start
```

The frontend should automatically open in your browser at http://localhost:3000

## Frontend Features

### 1. Portfolio Overview
- Real-time portfolio value and positions
- P&L tracking
- Cash balance display

### 2. AI Insights & Command Bar
- Market analysis powered by AI COO
- Interactive command input for custom analysis
- Trading opportunities and recommendations

### 3. Risk Management
- Portfolio risk metrics (VaR, Sharpe Ratio, Beta)
- Position-level risk analysis
- Risk alerts and warnings
- Stress testing capabilities

### 4. Strategy Analytics
- Real-time market quotes
- Technical indicators (RSI, SMA)
- Trading signals
- Multi-symbol support

### 5. Operations Console
- Service health monitoring
- Auto-refresh capabilities
- System status overview

### 6. Investor Portal
- Dashboard overview
- Market overview for major indices
- Trade execution interface
- Risk-validated order placement

## API Endpoints

The frontend connects to the following API endpoints through the proxy:

- `/api/risk/portfolio` - Portfolio data
- `/api/risk/report` - Risk analysis report
- `/api/data/market/quote/{symbol}` - Market quotes
- `/api/data/market/technicals/{symbol}` - Technical indicators
- `/api/ai/insights` - AI-generated insights
- `/api/analyze` - Custom market analysis
- `/api/dashboard` - Aggregated dashboard data
- `/api/execute-trade` - Trade execution with risk validation
- `/api/status` - Service status monitoring

## Configuration

### Frontend Proxy Configuration

The frontend is configured to proxy all `/api/*` requests to the API Gateway on port 3001. This is set in `frontend/package.json`:

```json
{
  "proxy": "http://localhost:3001"
}
```

### Environment Variables

Ensure your `.env` file contains the necessary configuration:

```env
# API Gateway
API_GATEWAY_PORT=3001

# Service URLs
MCP_HUB_URL=http://localhost:8000
DATA_HUB_URL=http://localhost:8001
AI_COO_URL=http://localhost:8002
RISK_ANALYZER_URL=http://localhost:8004

# Database
DATABASE_URL=your_database_url
REDIS_URL=redis://localhost:6380

# API Keys
ANTHROPIC_API_KEY=your_anthropic_key
```

## Troubleshooting

### Frontend not connecting to backend

1. Ensure all backend services are running:
   ```bash
   curl http://localhost:8000/health  # MCP Hub
   curl http://localhost:8001/health  # Data Hub
   curl http://localhost:8002/health  # AI COO
   curl http://localhost:8004/health  # Risk Analyzer
   curl http://localhost:3001/health  # API Gateway
   ```

2. Check the browser console for errors

3. Verify the proxy configuration in package.json

### Services not starting

1. Check Docker logs:
   ```bash
   docker-compose logs -f [service-name]
   ```

2. Ensure ports are not already in use:
   ```bash
   lsof -i :3001  # Check if port is in use
   ```

3. Verify environment variables are set correctly

## Development Tips

1. **Hot Reloading**: The frontend supports hot reloading. Changes to components will automatically reflect in the browser.

2. **API Testing**: Use the browser's Network tab to monitor API calls and responses.

3. **Component State**: Each component manages its own state and handles loading/error states appropriately.

4. **Responsive Design**: The UI is responsive and works on mobile devices.

## Next Steps

1. Implement real market data connections (currently using mock data)
2. Add WebSocket support for real-time updates
3. Implement user authentication and session management
4. Add more advanced trading features
5. Enhance the AI analysis capabilities

## Support

For issues or questions:
1. Check the service logs
2. Verify all services are healthy
3. Review the API Gateway routes
4. Check browser console for frontend errors

The system is now fully integrated and ready for use!