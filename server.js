require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
const indexHtml = path.join(publicPath, 'index.html');

// Create public directory if it doesn't exist
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}

app.use(express.static(publicPath));

// Health check endpoint - IMPORTANT FOR RAILWAY!
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// Database connection (Railway provides DATABASE_URL automatically when you add PostgreSQL)
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: process.env.NODE_ENV === 'production' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    })
  : null;

// Define all models in one place
const User = sequelize ? sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
}) : null;

const Portfolio = sequelize ? sequelize.define('Portfolio', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  totalValue: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0
  },
  cashBalance: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0
  }
}) : null;

const Position = sequelize ? sequelize.define('Position', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  portfolioId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false
  },
  avgCost: {
    type: DataTypes.DECIMAL(20, 2),
    allowNull: false
  }
}) : null;

// Initialize database
const initDB = async () => {
  if (sequelize) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connected');
      await sequelize.sync({ alter: true });
      console.log('✅ Database synchronized');
    } catch (error) {
      console.error('❌ Database error:', error.message);
      // Don't exit - app can run without database
    }
  } else {
    console.log('⚠️  No database URL provided - running without database');
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Field Elevate Trading Platform API',
    status: 'active',
    endpoints: {
      health: '/health',
      register: '/api/auth/register',
      login: '/api/auth/login',
      portfolio: '/api/portfolio',
      positions: '/api/positions',
      marketData: '/api/market-data',
      signals: '/api/signals'
    }
  });
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  if (!sequelize) return res.status(500).json({ error: 'Database not configured' });
  
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await User.create({
      email,
      password: hashedPassword,
      name
    });
    
    // Create default portfolio
    await Portfolio.create({
      userId: user.id,
      cashBalance: 100000 // Start with $100k paper money
    });
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'field-elevate-secret-key',
      { expiresIn: '30d' }
    );
    
    res.json({ 
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (!sequelize) return res.status(500).json({ error: 'Database not configured' });
  
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'field-elevate-secret-key',
      { expiresIn: '30d' }
    );
    
    res.json({ 
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Portfolio endpoint
app.get('/api/portfolio', async (req, res) => {
  // For now, return mock data
  res.json({
    totalValue: 125000,
    cashBalance: 50000,
    positions: 3,
    dayChange: 2500,
    dayChangePercent: 2.04,
    allTimeReturn: 25000,
    allTimeReturnPercent: 25
  });
});

// Positions endpoint
app.get('/api/positions', async (req, res) => {
  // Mock positions data
  res.json([
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      quantity: 100,
      avgCost: 150.00,
      currentPrice: 175.00,
      marketValue: 17500,
      unrealizedPnl: 2500,
      unrealizedPnlPercent: 16.67
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      quantity: 50,
      avgCost: 2800.00,
      currentPrice: 2850.00,
      marketValue: 142500,
      unrealizedPnl: 2500,
      unrealizedPnlPercent: 1.79
    }
  ]);
});

// Market data endpoint
app.get('/api/market-data', async (req, res) => {
  res.json({
    lastUpdate: new Date().toISOString(),
    markets: [
      { symbol: 'BTC-USD', price: 43250.00, change24h: 2.5 },
      { symbol: 'ETH-USD', price: 2340.00, change24h: 3.2 },
      { symbol: 'SPY', price: 475.50, change24h: 0.8 }
    ]
  });
});

// Trading signals endpoint
app.get('/api/signals', async (req, res) => {
  res.json({
    activeSignals: [
      {
        id: 1,
        symbol: 'AAPL',
        type: 'BUY',
        strength: 85,
        strategy: 'Momentum',
        entryPrice: 175.00,
        targetPrice: 185.00,
        stopLoss: 170.00
      },
      {
        id: 2,
        symbol: 'TSLA',
        type: 'SELL',
        strength: 72,
        strategy: 'Mean Reversion',
        entryPrice: 240.00,
        targetPrice: 220.00,
        stopLoss: 245.00
      }
    ]
  });
});

// Placeholder for future API routes
app.all('/api/*', (req, res) => {
  res.json({ error: 'Coming Soon' });
});

// Catch-all to serve the main UI
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Frontend not found. Please check the public directory.');
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    if (sequelize) {
      sequelize.close().then(() => {
        console.log('Database connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

// Start server if run directly
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Field Elevate API running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
    await initDB();
  });
  
  // Keep the server reference for graceful shutdown
  module.exports.server = server;
}

module.exports = { app, initDB, sequelize };
