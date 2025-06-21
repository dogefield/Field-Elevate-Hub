#!/bin/bash
# Build script for MCP Hub

echo "Building MCP Hub..."

# Install dependencies
npm install

# Build TypeScript
npm run build

echo "Build complete!"