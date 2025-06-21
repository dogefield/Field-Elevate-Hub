import React, { useEffect, useState } from 'react';

export default function InvestorPortal() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    side: 'BUY',
    quantity: '',
    price: ''
  });
  const [tradeResult, setTradeResult] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTradeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTradeResult(null);
    
    try {
      const response = await fetch('/api/execute-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tradeForm,
          quantity: parseInt(tradeForm.quantity),
          price: parseFloat(tradeForm.price)
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setTradeResult(result);
        if (result.success) {
          setTradeForm({ symbol: '', side: 'BUY', quantity: '', price: '' });
          fetchDashboardData(); // Refresh data
        }
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      setTradeResult({ success: false, reason: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="investor-portal">
      <h2>Investor Portal</h2>
      
      {loading && !dashboardData ? (
        <p>Loading dashboard...</p>
      ) : dashboardData ? (
        <div className="dashboard-overview">
          <div className="metrics-summary">
            <h3>Portfolio Summary</h3>
            <div className="metric">
              <span>Total Value:</span>
              <strong>${dashboardData.portfolio?.totalValue?.toFixed(2) || '0.00'}</strong>
            </div>
            <div className="metric">
              <span>Available Cash:</span>
              <strong>${dashboardData.portfolio?.cash?.toFixed(2) || '0.00'}</strong>
            </div>
            <div className="metric">
              <span>Daily P&L:</span>
              <strong className={dashboardData.portfolio?.totalPnL >= 0 ? 'positive' : 'negative'}>
                ${dashboardData.portfolio?.totalPnL?.toFixed(2) || '0.00'}
              </strong>
            </div>
          </div>

          {dashboardData.marketData && (
            <div className="market-overview">
              <h3>Market Overview</h3>
              <div className="market-grid">
                {Object.entries(dashboardData.marketData).map(([symbol, data]) => (
                  <div key={symbol} className="market-item">
                    <strong>{symbol}</strong>
                    <span>${data.price?.toFixed(2)}</span>
                    <span className={data.change >= 0 ? 'positive' : 'negative'}>
                      {data.change >= 0 ? '+' : ''}{data.changePercent?.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="trade-execution">
        <h3>Execute Trade</h3>
        <form onSubmit={handleTradeSubmit}>
          <div className="form-group">
            <label>Symbol:</label>
            <input
              type="text"
              value={tradeForm.symbol}
              onChange={(e) => setTradeForm({...tradeForm, symbol: e.target.value.toUpperCase()})}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Side:</label>
            <select
              value={tradeForm.side}
              onChange={(e) => setTradeForm({...tradeForm, side: e.target.value})}
            >
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Quantity:</label>
            <input
              type="number"
              value={tradeForm.quantity}
              onChange={(e) => setTradeForm({...tradeForm, quantity: e.target.value})}
              min="1"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Price:</label>
            <input
              type="number"
              step="0.01"
              value={tradeForm.price}
              onChange={(e) => setTradeForm({...tradeForm, price: e.target.value})}
              min="0.01"
              required
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Execute Trade'}
          </button>
        </form>

        {tradeResult && (
          <div className={`trade-result ${tradeResult.success ? 'success' : 'error'}`}>
            {tradeResult.success ? (
              <p>✓ Trade executed successfully!</p>
            ) : (
              <>
                <p>✗ Trade failed: {tradeResult.reason}</p>
                {tradeResult.suggestions && (
                  <ul>
                    {tradeResult.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
