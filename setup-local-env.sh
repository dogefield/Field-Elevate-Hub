#!/bin/bash

echo "🔧 Setting up Field-Elevate-Hub Local Environment"
echo "================================================"

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file."
        exit 0
    fi
fi

# Create .env file with Docker-specific ports
cat > .env << 'EOF'
# Database Configuration
# Using port 5433 for local PostgreSQL (Docker)
DATABASE_URL=postgresql://fieldelevate:fieldelevate123@localhost:5433/fieldelevate

# Redis Configuration
# Using port 6380 for local Redis (Docker)
REDIS_URL=redis://localhost:6380

# API Keys (Copy these values from your Render environment group)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CLAUDE_MODEL=your_claude_model_here

# JWT Secret for authentication
JWT_SECRET=field-elevate-secret-key-change-this-in-production

# Service URLs (for local development)
MCP_HUB_URL=http://localhost:3001
DATA_HUB_URL=http://localhost:3002
AI_COO_URL=http://localhost:3003

# Environment
NODE_ENV=development

# Port Configuration
PORT=3000

# Grafana Configuration
GRAFANA_PASSWORD=admin

# Additional API Keys (add as needed from Render)
# OPENAI_API_KEY=your_openai_api_key_here
# COINBASE_API_KEY=your_coinbase_api_key_here
# COINBASE_API_SECRET=your_coinbase_api_secret_here
# SENDGRID_API_KEY=your_sendgrid_api_key_here
EOF

echo "✅ Created .env file with Docker-specific configuration"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env and add your API keys from Render's field-elevate-shared environment group"
echo "2. The database and Redis are configured to use Docker ports (5433 and 6380)"
echo "3. Run 'wsl docker compose up -d' to start all services"
echo ""
echo "🔑 API Keys needed from Render:"
echo "   - ANTHROPIC_API_KEY"
echo "   - CLAUDE_MODEL"
echo "   - Any other keys in your field-elevate-shared group" 