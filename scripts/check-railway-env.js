#!/usr/bin/env node

console.log('🚂 Railway Environment Check\n');
console.log('='.repeat(50));

// Check critical environment variables
const requiredVars = {
  'DATABASE_URL': '🗄️  PostgreSQL connection string',
  'PORT': '🚪 Port number (Railway sets this automatically)',
  'NODE_ENV': '🌍 Environment (should be "production")',
  'RAILWAY_ENVIRONMENT_NAME': '🏷️  Railway environment',
  'RAILWAY_PROJECT_ID': '📁 Railway project ID'
};

const optionalVars = {
  'REDIS_URL': '💾 Redis connection (if using Redis)',
  'ANTHROPIC_API_KEY': '🤖 AI API key',
  'JWT_SECRET': '🔐 JWT secret for auth'
};

console.log('REQUIRED Variables:');
console.log('-'.repeat(50));

Object.entries(requiredVars).forEach(([key, desc]) => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${key}: ${desc}`);
    if (key === 'DATABASE_URL') {
      // Parse and validate DATABASE_URL format
      try {
        const url = new URL(value);
        console.log(`   Protocol: ${url.protocol}`);
        console.log(`   Host: ${url.hostname}`);
        console.log(`   Database: ${url.pathname.slice(1)}`);
      } catch (e) {
        console.log(`   ⚠️  Invalid URL format!`);
      }
    }
  } else {
    console.log(`❌ ${key}: MISSING - ${desc}`);
  }
});

console.log('\nOPTIONAL Variables:');
console.log('-'.repeat(50));

Object.entries(optionalVars).forEach(([key, desc]) => {
  const value = process.env[key];
  console.log(`${value ? '✅' : '⚠️ '} ${key}: ${value ? 'SET' : 'NOT SET'} - ${desc}`);
});

// Test database connection
if (process.env.DATABASE_URL) {
  console.log('\n📊 Testing Database Connection...');
  console.log('-'.repeat(50));
  
  const { Sequelize } = require('sequelize');
  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });

  sequelize.authenticate()
    .then(() => {
      console.log('✅ Database connection successful!');
      process.exit(0);
    })
    .catch(err => {
      console.log('❌ Database connection failed!');
      console.log(`   Error: ${err.message}`);
      process.exit(1);
    });
} else {
  console.log('\n⚠️  Cannot test database - DATABASE_URL not set');
  process.exit(1);
}