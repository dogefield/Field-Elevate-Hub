import axios from 'axios';
import { config } from '../config.js';

export class NewsService {
  constructor(redis) {
    this.redis = redis;
  }

  async getNews(symbol, limit = 10) {
    const cacheKey = `news:${symbol}:${limit}`;
    
    // Check cache
    if (this.redis?.isReady) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Try Polygon API for news
      if (config.marketData.polygon.apiKey && config.marketData.polygon.apiKey !== 'your_polygon_api_key_here') {
        const response = await axios.get(
          `${config.marketData.polygon.baseUrl}/v2/reference/news`,
          {
            params: {
              ticker: symbol,
              limit,
              apiKey: config.marketData.polygon.apiKey
            }
          }
        );

        const news = response.data.results.map(article => ({
          title: article.title,
          description: article.description,
          url: article.article_url,
          publisher: article.publisher.name,
          publishedAt: article.published_utc,
          tickers: article.tickers,
          sentiment: this.analyzeSentiment(article.title + ' ' + article.description)
        }));

        if (this.redis?.isReady) {
          await this.redis.setEx(cacheKey, config.cache.newsDataTTL, JSON.stringify(news));
        }

        return news;
      }
    } catch (error) {
      console.error('Error fetching news:', error.message);
    }

    // Return mock news for development
    const mockNews = [
      {
        title: `${symbol} Shows Strong Performance in Latest Trading Session`,
        description: 'Stock demonstrates resilience amid market volatility...',
        url: '#',
        publisher: 'Field Elevate News',
        publishedAt: new Date().toISOString(),
        tickers: [symbol],
        sentiment: 'positive'
      },
      {
        title: `Analysts Update ${symbol} Price Targets`,
        description: 'Several major firms adjust their outlook...',
        url: '#',
        publisher: 'Market Analysis Daily',
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        tickers: [symbol],
        sentiment: 'neutral'
      },
      {
        title: `${symbol} Faces Headwinds from Sector Rotation`,
        description: 'Investors moving to defensive positions...',
        url: '#',
        publisher: 'Trading Insights',
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        tickers: [symbol],
        sentiment: 'negative'
      }
    ];

    if (this.redis?.isReady) {
      await this.redis.setEx(cacheKey, config.cache.newsDataTTL, JSON.stringify(mockNews));
    }

    return mockNews;
  }

  analyzeSentiment(text) {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['strong', 'gain', 'rise', 'up', 'beat', 'exceed', 'positive', 'growth', 'bull'];
    const negativeWords = ['weak', 'loss', 'fall', 'down', 'miss', 'below', 'negative', 'decline', 'bear'];
    
    const lowerText = text.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score++;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score--;
    });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  async getMarketSentiment() {
    const majorSymbols = ['SPY', 'QQQ', 'DIA', 'IWM'];
    const sentiments = { positive: 0, negative: 0, neutral: 0 };

    for (const symbol of majorSymbols) {
      const news = await this.getNews(symbol, 5);
      news.forEach(article => {
        sentiments[article.sentiment]++;
      });
    }

    const total = sentiments.positive + sentiments.negative + sentiments.neutral;
    
    return {
      overall: this.calculateOverallSentiment(sentiments),
      breakdown: {
        positive: (sentiments.positive / total) * 100,
        negative: (sentiments.negative / total) * 100,
        neutral: (sentiments.neutral / total) * 100
      },
      sampleSize: total,
      timestamp: new Date().toISOString()
    };
  }

  calculateOverallSentiment(sentiments) {
    const score = (sentiments.positive - sentiments.negative) / 
                  (sentiments.positive + sentiments.negative + sentiments.neutral);
    
    if (score > 0.2) return 'bullish';
    if (score < -0.2) return 'bearish';
    return 'neutral';
  }
}