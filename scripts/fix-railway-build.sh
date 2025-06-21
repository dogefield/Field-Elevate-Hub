#!/bin/bash

echo "🚂 Railway Build Fix Script"
echo "=========================="

# Check if frontend/build exists locally
if [ ! -d "frontend/build" ]; then
    echo "⚠️  Frontend build not found locally. Building now..."
    npm install
    cd frontend
    npm install
    npm run build
    cd ..
    echo "✅ Frontend build created locally"
else
    echo "✅ Frontend build already exists locally"
fi

echo ""
echo "📋 MANUAL STEPS REQUIRED IN RAILWAY DASHBOARD:"
echo "=============================================="
echo ""
echo "1. Go to your Railway project dashboard"
echo "2. Click on your service"
echo "3. Go to 'Settings' tab"
echo "4. Scroll to 'Build' section"
echo "5. Set Build Command to:"
echo "   npm install && cd frontend && npm install && npm run build"
echo ""
echo "6. Set Start Command to:"
echo "   node server.js"
echo ""
echo "7. Click 'Save' and Railway will redeploy automatically"
echo ""
echo "Alternative: If Railway ignores the build command, try:"
echo "- Delete the service and recreate it"
echo "- Or use a custom Dockerfile"
echo ""
echo "🔍 To check logs after redeployment:"
echo "   railway logs --tail 100"