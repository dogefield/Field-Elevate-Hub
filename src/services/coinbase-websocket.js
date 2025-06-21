const WebSocket = require('ws');
const EventEmitter = require('events');

class CoinbaseWebSocket extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.subscriptions = new Set();
    this.prices = new Map();
    this.reconnectInterval = 5000;
    this.heartbeatInterval = null;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

    this.ws.on('open', () => {
      console.log('✅ Coinbase WebSocket connected');
      this.emit('connected');
      this.startHeartbeat();
      this.subscribeToChannels();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('❌ Coinbase WebSocket error:', error);
      this.emit('error', error);
    });

    this.ws.on('close', () => {
      console.log('🔌 Coinbase WebSocket disconnected');
      this.emit('disconnected');
      this.stopHeartbeat();
      this.reconnect();
    });
  }

  reconnect() {
    setTimeout(() => {
      console.log('🔄 Attempting to reconnect to Coinbase...');
      this.connect();
    }, this.reconnectInterval);
  }

  subscribe(productIds = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD', 'MATIC-USD', 'LINK-USD']) {
    productIds.forEach(id => this.subscriptions.add(id));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.subscribeToChannels();
    }
  }

  subscribeToChannels() {
    const subscribeMessage = {
      type: 'subscribe',
      product_ids: Array.from(this.subscriptions),
      channels: [
        'ticker',
        'heartbeat'
      ]
    };

    this.ws.send(JSON.stringify(subscribeMessage));
  }

  handleMessage(message) {
    switch (message.type) {
      case 'ticker':
        this.handleTickerMessage(message);
        break;
      case 'heartbeat':
        // Keep connection alive
        break;
      case 'subscriptions':
        console.log('📊 Subscribed to:', message.channels);
        break;
      case 'error':
        console.error('Coinbase error:', message.message);
        break;
    }
  }

  handleTickerMessage(ticker) {
    const priceData = {
      productId: ticker.product_id,
      price: parseFloat(ticker.price),
      bestBid: parseFloat(ticker.best_bid),
      bestAsk: parseFloat(ticker.best_ask),
      volume24h: parseFloat(ticker.volume_24h),
      low24h: parseFloat(ticker.low_24h),
      high24h: parseFloat(ticker.high_24h),
      open24h: parseFloat(ticker.open_24h),
      timestamp: ticker.time
    };

    // Calculate 24h change percentage
    if (priceData.open24h > 0) {
      priceData.change24h = ((priceData.price - priceData.open24h) / priceData.open24h) * 100;
    } else {
      priceData.change24h = 0;
    }

    this.prices.set(ticker.product_id, priceData);
    this.emit('price', priceData);
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getCurrentPrices() {
    return Object.fromEntries(this.prices);
  }

  getPrice(productId) {
    return this.prices.get(productId);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = CoinbaseWebSocket;