#!/bin/bash

echo "🚀 Setting up Field Elevate Hub..."

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }

# Create necessary directories
mkdir -p logs
mkdir -p data/redis
mkdir -p data/postgres
mkdir -p grafana/dashboards
mkdir -p grafana/datasources

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file. Please update with your values."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infrastructure
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Test Redis connection
echo "🔴 Testing Redis connection..."
docker exec field-elevate-redis redis-cli ping

# Test PostgreSQL connection
echo "🐘 Testing PostgreSQL connection..."
docker exec field-elevate-postgres pg_isready

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your Replit app URLs"
echo "2. Run 'npm run dev' to start the MCP hub"
echo "3. Access Grafana at http://localhost:3000 (admin/admin)"
echo ""
