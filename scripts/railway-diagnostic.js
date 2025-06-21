#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚂 Railway Deployment Diagnostic Tool\n');

// Function to run commands and capture output
function runCommand(cmd, options = {}) {
    try {
        const output = execSync(cmd, { stdio: 'pipe', ...options }).toString();
        return { success: true, output };
    } catch (err) {
        return { success: false, error: err.message, output: err.stderr?.toString() || '' };
    }
}

// Check Railway CLI installation
console.log('1. Checking Railway CLI installation...');
const railwayCLI = runCommand('railway --version');
if (railwayCLI.success) {
    console.log('✅ Railway CLI is installed:', railwayCLI.output.trim());
} else {
    console.log('❌ Railway CLI not installed. Install with: npm install -g @railway/cli');
    process.exit(1);
}

// Check Railway login status
console.log('\n2. Checking Railway login status...');
const loginStatus = runCommand('railway whoami');
if (loginStatus.success) {
    console.log('✅ Logged in as:', loginStatus.output.trim());
} else {
    console.log('❌ Not logged in to Railway');
    console.log('   To login: railway login');
    console.log('   Or with token: railway login --token YOUR_TOKEN');
}

// Check if linked to a project
console.log('\n3. Checking project link...');
const projectStatus = runCommand('railway status');
if (projectStatus.success) {
    console.log('✅ Linked to project:', projectStatus.output.trim());
} else {
    console.log('❌ Not linked to a Railway project');
    console.log('   To link: railway link PROJECT_ID');
}

// Check environment variables
console.log('\n4. Checking Railway environment variables...');
const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'ANTHROPIC_API_KEY',
    'NODE_ENV',
    'PORT'
];

console.log('Required environment variables:');
const envVars = runCommand('railway variables');
if (envVars.success) {
    requiredVars.forEach(varName => {
        if (envVars.output.includes(varName)) {
            console.log(`✅ ${varName} is set`);
        } else {
            console.log(`❌ ${varName} is missing`);
        }
    });
} else {
    console.log('❌ Could not retrieve environment variables');
    console.log('   Make sure you are logged in and linked to a project');
}

// Check for railway.json or railway.toml
console.log('\n5. Checking for Railway configuration files...');
const hasRailwayJson = fs.existsSync('railway.json');
const hasRailwayToml = fs.existsSync('railway.toml');
if (hasRailwayJson || hasRailwayToml) {
    console.log('✅ Found Railway configuration file');
} else {
    console.log('⚠️  No railway.json or railway.toml found (optional)');
}

// Check deployment logs
console.log('\n6. Getting recent deployment logs...');
if (projectStatus.success) {
    const logs = runCommand('railway logs --tail 50');
    if (logs.success) {
        console.log('Recent logs:');
        console.log('---');
        console.log(logs.output);
        console.log('---');
        
        // Look for common errors
        if (logs.output.includes('ANTHROPIC_API_KEY')) {
            console.log('\n⚠️  Found API key error in logs!');
            console.log('   Set it with: railway variables:set ANTHROPIC_API_KEY=your_key_here');
        }
        if (logs.output.includes('Cannot find module')) {
            console.log('\n⚠️  Found module error in logs!');
            console.log('   Make sure build command runs npm install in all directories');
        }
    } else {
        console.log('❌ Could not retrieve logs');
    }
}

// Compare with Render configuration
console.log('\n7. Comparing with Render configuration...');
console.log('Render uses these build commands:');
console.log('  - Main app: npm install && cd frontend && npm install && npm run build');
console.log('  - MCP Hub: cd mcp-hub && npm install && npm run build');
console.log('  - Data Hub: cd data-hub && npm install');
console.log('  - AI COO: cd ai-coo && npm install && npm run build');

console.log('\n🔧 Quick fixes for common Railway issues:');
console.log('1. Set missing environment variables:');
console.log('   railway variables:set ANTHROPIC_API_KEY=your_key_here');
console.log('   railway variables:set DATABASE_URL=your_db_url');
console.log('   railway variables:set REDIS_URL=your_redis_url');
console.log('\n2. Set build command in Railway dashboard to match Render:');
console.log('   npm install && cd frontend && npm install && npm run build');
console.log('\n3. Make sure start command is set to:');
console.log('   node server.js');
console.log('\n4. Check Railway dashboard for service health and error logs');

// Create a Railway configuration template
console.log('\n8. Creating railway.json template...');
const railwayConfig = {
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "NIXPACKS",
        "buildCommand": "npm install && cd frontend && npm install && npm run build"
    },
    "deploy": {
        "startCommand": "node server.js",
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
    }
};

fs.writeFileSync('railway.json', JSON.stringify(railwayConfig, null, 2));
console.log('✅ Created railway.json configuration file');
console.log('   Review and adjust as needed, then redeploy');