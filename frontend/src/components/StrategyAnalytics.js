import React, { useEffect, useState } from 'react';

export default function StrategyAnalytics() {
  const [marketData, setMarketData] = useState({});
  const [technicals, setTechnicals] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [symbols] = useState(['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT']);

  useEffect(() => {
    fetchMarketData();
  }, [selectedSymbol]);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      // Fetch quote data
      const quoteResponse = await fetch(`/api/data/market/quote/${selectedSymbol}`);
      if (quoteResponse.ok) {
        const quote = await quoteResponse.json();
        setMarketData(prev => ({ ...prev, [selectedSymbol]: quote }));
      }

      // Fetch technical indicators
      const techResponse = await fetch(`/api/data/market/technicals/${selectedSymbol}`);
      if (techResponse.ok) {
        const tech = await techResponse.json();
        setTechnicals(prev => ({ ...prev, [selectedSymbol]: tech }));
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentQuote = marketData[selectedSymbol];
  const currentTech = technicals[selectedSymbol];

  return (
    <section className="strategy-analytics">
      <h2>Strategy Analytics</h2>
      
      <div className="symbol-selector">
        <select 
          value={selectedSymbol} 
          onChange={(e) => setSelectedSymbol(e.target.value)}
        >
          {symbols.map(symbol => (
            <option key={symbol} value={symbol}>{symbol}</option>
          ))}
        </select>
        <button onClick={fetchMarketData} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading market data...</p>
      ) : (
        <>
          {currentQuote && (
            <div className="market-quote">
              <h3>{selectedSymbol} - Market Data</h3>
              <div className="quote-grid">
                <div className="quote-item">
                  <span className="label">Price:</span>
                  <span className="value">${currentQuote.price?.toFixed(2)}</span>
                </div>
                <div className="quote-item">
                  <span className="label">Change:</span>
                  <span className={`value ${currentQuote.change >= 0 ? 'positive' : 'negative'}`}>
                    {currentQuote.change >= 0 ? '+' : ''}{currentQuote.change?.toFixed(2)} 
                    ({currentQuote.changePercent?.toFixed(2)}%)
                  </span>
                </div>
                <div className="quote-item">
                  <span className="label">Volume:</span>
                  <span className="value">{(currentQuote.volume / 1000000).toFixed(2)}M</span>
                </div>
                <div className="quote-item">
                  <span className="label">Day Range:</span>
                  <span className="value">
                    ${currentQuote.low?.toFixed(2)} - ${currentQuote.high?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentTech && (
            <div className="technical-indicators">
              <h3>Technical Indicators</h3>
              <div className="indicators-grid">
                <div className="indicator">
                  <span className="label">RSI (14):</span>
                  <span className={`value ${
                    currentTech.rsi > 70 ? 'overbought' : 
                    currentTech.rsi < 30 ? 'oversold' : ''
                  }`}>
                    {currentTech.rsi?.toFixed(2)}
                  </span>
                </div>
                <div className="indicator">
                  <span className="label">SMA (20):</span>
                  <span className="value">${currentTech.sma20?.toFixed(2)}</span>
                </div>
                <div className="indicator">
                  <span className="label">SMA (50):</span>
                  <span className="value">${currentTech.sma50?.toFixed(2)}</span>
                </div>
                <div className="indicator">
                  <span className="label">Trend:</span>
                  <span className={`value ${currentTech.trend?.toLowerCase()}`}>
                    {currentTech.trend}
                  </span>
                </div>
              </div>

              {currentTech.signals && currentTech.signals.length > 0 && (
                <div className="trading-signals">
                  <h4>Trading Signals</h4>
                  <ul>
                    {currentTech.signals.map((signal, idx) => (
                      <li key={idx} className={`signal ${signal.type}`}>
                        {signal.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
