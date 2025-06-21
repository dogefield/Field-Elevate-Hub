# Field Elevate Platform - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed (✅ You already have this!)
- Git
- An Anthropic API key (for AI features)

### Local Development Setup

1. **Clone and navigate to the project**
   ```bash
   cd Field-Elevate-Hub
   ```

2. **Create environment file**
   ```bash
   cp env.example .env
   ```
   
3. **Edit .env file**
   - Add your Anthropic API key
   - Other values can remain as defaults for local development

4. **Start all services with Docker Compose**
   ```bash
   wsl docker compose up -d
   ```

5. **Verify services are running**
   ```bash
   wsl docker compose ps
   ```

6. **Access the services**
   - MCP Hub: http://localhost:3001
   - Data Hub: http://localhost:3002
   - AI COO: http://localhost:3003

### Stopping Services
```bash
wsl docker compose down
```

## 🌐 Production Deployment (Render)

### Why Render?
- Supports Docker deployments
- Free tier available for testing
- Auto-deploys from GitHub
- Built-in PostgreSQL and Redis
- Your project already has render.yaml configured

### Deployment Steps

1. **Create a Render account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Connect your GitHub repository**
   - In Render dashboard, click "New +"
   - Select "Blueprint"
   - Connect to `dogefield/Field-Elevate-Hub` repository

3. **Configure environment variables**
   In Render dashboard, create a new Environment Group called `field-elevate-shared`:
   - `DATABASE_URL` - Will be auto-filled by Render
   - `REDIS_URL` - Will be auto-filled by Render
   - `ANTHROPIC_API_KEY` - Your API key

4. **Deploy**
   - Render will automatically deploy using render.yaml
   - All three services will be created

### Alternative: Vercel (Not Recommended)
Vercel is better for static sites and serverless functions. Since Field Elevate is a microservices platform with databases, Render is the better choice.

## 📊 Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    MCP Hub      │     │   Data Hub      │     │    AI COO       │
│  (Port 3001)    │────▶│  (Port 3002)    │────▶│  (Port 3003)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         └───────────┬───────────┴─────────────────────────┘
                     │
              ┌──────┴──────┐        ┌──────────────┐
              │    Redis    │        │  PostgreSQL  │
              │  (Port 6379)│        │  (Port 5432) │
              └─────────────┘        └──────────────┘
```

## 🔧 Common Commands

### View logs
```bash
# All services
wsl docker compose logs -f

# Specific service
wsl docker compose logs -f mcp-hub
```

### Rebuild after code changes
```bash
wsl docker compose build
wsl docker compose up -d
```

### Access service shell
```bash
wsl docker compose exec mcp-hub sh
```

### Database access
```bash
wsl docker compose exec postgres psql -U fieldelevate
```

## 🚨 Troubleshooting

### Services not starting?
1. Check logs: `wsl docker compose logs`
2. Ensure ports aren't in use: `wsl netstat -tuln`
3. Restart Docker: `wsl sudo service docker restart`

### Can't connect to services?
- Make sure you're using the correct ports (3001, 3002, 3003)
- Check Windows Firewall settings
- Try accessing via WSL: `wsl curl http://localhost:3001`

### Need help?
- Check service health: `wsl docker compose ps`
- Review logs: `wsl docker compose logs [service-name]`
- Restart everything: `wsl docker compose restart`

## 🎯 Next Steps

1. **Test the platform locally** using Docker Compose
2. **Deploy to Render** for production
3. **Add the dashboard** we created earlier
4. **Configure trading strategies** in the AI COO service

## 📝 Notes for Non-Coders

- Docker Compose handles all the complex setup
- Services automatically connect to each other
- Changes to code require rebuilding: `wsl docker compose build`
- Always check logs if something isn't working
- The platform is designed to be self-healing and resilient 