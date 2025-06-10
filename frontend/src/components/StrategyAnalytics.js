import React, { useEffect, useState } from 'react';

export default function StrategyAnalytics() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/data-hub/api/strategies/historical')
      .then(res => res.json())
      .then(res => setData(res.strategies || []))
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Strategy Analytics</h2>
      {data.length ? (
        <ul>
          {data.map(s => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      ) : (
        <p>No data</p>
      )}
    </section>
  );
}
