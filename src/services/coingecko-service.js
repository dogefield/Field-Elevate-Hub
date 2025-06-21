const axios = require('axios');

class CoinGeckoService {
  constructor() {
    this.baseURL = 'https://api.coingecko.com/api/v3';
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  async getCoinData(coinIds = ['bitcoin', 'ethereum', 'solana', 'avalanche-2', 'matic-network', 'chainlink']) {
    const cacheKey = 'coin_data';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await axios.get(`${this.baseURL}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: coinIds.join(','),
          order: 'market_cap_desc',
          per_page: 20,
          page: 1,
          sparkline: true,
          price_change_percentage: '1h,24h,7d'
        }
      });

      const data = response.data.map(coin => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        change24h: coin.price_change_percentage_24h,
        change7d: coin.price_change_percentage_7d,
        sparkline: coin.sparkline_in_7d.price.slice(-24), // Last 24 hours
        image: coin.image
      }));

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('CoinGecko API error:', error.message);
      return [];
    }
  }

  async getGlobalData() {
    const cacheKey = 'global_data';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await axios.get(`${this.baseURL}/global`);
      const data = {
        totalMarketCap: response.data.data.total_market_cap.usd,
        totalVolume24h: response.data.data.total_volume.usd,
        btcDominance: response.data.data.market_cap_percentage.btc,
        ethDominance: response.data.data.market_cap_percentage.eth,
        activeCoins: response.data.data.active_cryptocurrencies,
        markets: response.data.data.markets
      };

      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('CoinGecko Global API error:', error.message);
      return null;
    }
  }

  async getTrendingCoins() {
    try {
      const response = await axios.get(`${this.baseURL}/search/trending`);
      return response.data.coins.slice(0, 5).map(item => ({
        id: item.item.id,
        name: item.item.name,
        symbol: item.item.symbol,
        rank: item.item.market_cap_rank
      }));
    } catch (error) {
      console.error('CoinGecko Trending API error:', error.message);
      return [];
    }
  }

  // Calculate portfolio value based on holdings
  calculatePortfolioValue(holdings, prices) {
    let totalValue = 0;
    const positions = [];

    for (const [coin, amount] of Object.entries(holdings)) {
      const priceData = prices.find(p => p.id === coin || p.symbol === coin.toUpperCase());
      if (priceData) {
        const value = amount * priceData.price;
        totalValue += value;
        positions.push({
          coin: priceData.symbol,
          amount,
          price: priceData.price,
          value,
          change24h: priceData.change24h
        });
      }
    }

    return { totalValue, positions };
  }
}

module.exports = new CoinGeckoService();