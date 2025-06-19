#!/bin/bash

echo "🚀 Field Elevate Platform Setup"
echo "==============================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Starting Docker..."
    sudo service docker start
    sleep 5
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env and add your ANTHROPIC_API_KEY"
    echo "   Press Enter when done..."
    read
fi

# Build and start services
echo "🔨 Building Docker images..."
docker compose build

echo "🚀 Starting services..."
docker compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Access your services at:"
echo "   - MCP Hub: http://localhost:3001"
echo "   - Data Hub: http://localhost:3002"
echo "   - AI COO: http://localhost:3003"
echo ""
echo "📝 To view logs: docker compose logs -f"
echo "🛑 To stop: docker compose down" 