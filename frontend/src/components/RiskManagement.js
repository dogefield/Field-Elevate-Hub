import React, { useEffect, useState } from 'react';

export default function RiskManagement() {
  const [risk, setRisk] = useState(null);

  useEffect(() => {
    fetch('/risk-analyzer/api/risk')
      .then(res => res.json())
      .then(setRisk)
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Risk Management</h2>
      {risk ? (
        <ul>
          <li>Current VaR: {risk.var}</li>
          <li>Exposure Alert: {risk.alert}</li>
        </ul>
      ) : (
        <p>Loading...</p>
      )}
    </section>
  );
}
