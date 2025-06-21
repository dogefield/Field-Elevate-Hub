#!/bin/bash
# Deployment script for MCP Hub on Render

echo "=== MCP Hub Deployment Script ==="
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# Navigate to MCP Hub directory
if [ -d "mcp-hub" ]; then
    cd mcp-hub
    echo "Changed to mcp-hub directory"
else
    echo "ERROR: mcp-hub directory not found!"
    exit 1
fi

echo "Installing dependencies..."
npm install

echo "Building TypeScript..."
npm run build

echo "Checking dist directory..."
ls -la dist/

echo "Deployment preparation complete!"