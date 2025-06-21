import React, { useEffect, useState } from 'react';

export default function PortfolioOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/risk/portfolio')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch portfolio');
        return res.json();
      })
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <section><h2>Portfolio Overview</h2><p>Loading...</p></section>;
  if (error) return <section><h2>Portfolio Overview</h2><p>Error: {error}</p></section>;

  return (
    <section>
      <h2>Portfolio Overview</h2>
      {data ? (
        <div>
          <ul>
            <li>Total Value: ${data.totalValue?.toFixed(2) || '0.00'}</li>
            <li>Available Cash: ${data.cash?.toFixed(2) || '0.00'}</li>
            <li>P&L: ${data.totalPnL?.toFixed(2) || '0.00'} ({data.totalPnLPercent?.toFixed(2) || '0.00'}%)</li>
          </ul>
          {data.positions && data.positions.length > 0 && (
            <div>
              <h3>Positions</h3>
              <ul>
                {data.positions.map(pos => (
                  <li key={pos.symbol}>
                    {pos.symbol}: {pos.quantity} shares @ ${pos.currentPrice?.toFixed(2)} 
                    (P&L: ${pos.pnl?.toFixed(2)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p>No portfolio data available</p>
      )}
    </section>
  );
}
