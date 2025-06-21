import React, { useEffect, useState } from 'react';

export default function PortfolioOverview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/portfolio')
      .then(res => res.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Portfolio Overview</h2>
      {data ? (
        <ul>
          <li>Total Value: ${data.totalValue}</li>
          <li>Today's Return: {data.dayChange}</li>
          <li>Positions: {data.positions}</li>
        </ul>
      ) : (
        <p>Loading...</p>
      )}
    </section>
  );
}
