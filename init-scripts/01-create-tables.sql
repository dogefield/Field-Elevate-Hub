-- Create database if not exists
CREATE DATABASE IF NOT EXISTS fieldelevate;

-- Use the database
\c fieldelevate;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Strategies table
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('momentum', 'mean_reversion', 'arbitrage', 'ml_based', 'hybrid')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'paused', 'testing', 'retired')),
    parameters JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strategy performance table
CREATE TABLE strategy_performance (
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    date DATE NOT NULL,
    total_return DECIMAL(10, 4),
    sharpe_ratio DECIMAL(8, 4),
    sortino_ratio DECIMAL(8, 4),
    max_drawdown DECIMAL(8, 4),
    win_rate DECIMAL(5, 4),
    total_trades INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (strategy_id, date)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('strategy_performance', 'date');

-- Trades table
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    entry_price DECIMAL(20, 8) NOT NULL,
    exit_price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ,
    pnl DECIMAL(20, 8),
    pnl_percentage DECIMAL(10, 4),
    fees DECIMAL(20, 8) DEFAULT 0,
    slippage DECIMAL(20, 8) DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed', 'cancelled')),
    exit_reason VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market data table
CREATE TABLE market_data (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8),
    high DECIMAL(20, 8),
    low DECIMAL(20, 8),
    open DECIMAL(20, 8),
    close DECIMAL(20, 8),
    source VARCHAR(50),
    PRIMARY KEY (time, symbol)
);

-- Convert to hypertable
SELECT create_hypertable('market_data', 'time');

-- Indicators table
CREATE TABLE indicators (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    indicator_name VARCHAR(50) NOT NULL,
    value DECIMAL(20, 8) NOT NULL,
    signal VARCHAR(20),
    confidence DECIMAL(5, 4),
    timeframe VARCHAR(20),
    PRIMARY KEY (time, symbol, indicator_name)
);

-- Convert to hypertable
SELECT create_hypertable('indicators', 'time');

-- System events table
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    source VARCHAR(100) NOT NULL,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_strategies_status ON strategies(status);
CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_entry_time ON trades(entry_time);
CREATE INDEX idx_system_events_severity ON system_events(severity);
CREATE INDEX idx_system_events_created_at ON system_events(created_at);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
