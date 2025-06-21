import React, { useEffect, useState } from 'react';

export default function RiskManagement() {
  const [riskMetrics, setRiskMetrics] = useState(null);
  const [riskReport, setRiskReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stressTestResults, setStressTestResults] = useState(null);

  useEffect(() => {
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      // Fetch risk report
      const reportResponse = await fetch('/api/risk/report');
      if (reportResponse.ok) {
        const report = await reportResponse.json();
        setRiskReport(report);
      }
    } catch (error) {
      console.error('Error fetching risk data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runStressTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/risk/stress/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: ['market_crash', 'volatility_spike', 'sector_rotation']
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        setStressTestResults(results);
      }
    } catch (error) {
      console.error('Error running stress test:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !riskReport) {
    return <section><h2>Risk Management</h2><p>Loading risk data...</p></section>;
  }

  return (
    <section className="risk-management">
      <h2>Risk Management</h2>
      
      {riskReport && (
        <div className="risk-metrics">
          <h3>Portfolio Risk Metrics</h3>
          <div className="metrics-grid">
            <div className="metric">
              <span className="label">Value at Risk (95%):</span>
              <span className="value">${riskReport.portfolioMetrics?.VaR95?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="label">Max Drawdown:</span>
              <span className="value">{riskReport.portfolioMetrics?.maxDrawdown?.toFixed(2) || '0'}%</span>
            </div>
            <div className="metric">
              <span className="label">Sharpe Ratio:</span>
              <span className="value">{riskReport.portfolioMetrics?.sharpeRatio?.toFixed(2) || 'N/A'}</span>
            </div>
            <div className="metric">
              <span className="label">Portfolio Beta:</span>
              <span className="value">{riskReport.portfolioMetrics?.beta?.toFixed(2) || 'N/A'}</span>
            </div>
          </div>

          {riskReport.positions && riskReport.positions.length > 0 && (
            <div className="position-risks">
              <h3>Position Risk Analysis</h3>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Exposure</th>
                    <th>Risk %</th>
                    <th>Stop Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {riskReport.positions.map(pos => (
                    <tr key={pos.symbol}>
                      <td>{pos.symbol}</td>
                      <td>${pos.exposure?.toFixed(2)}</td>
                      <td>{pos.riskPercent?.toFixed(2)}%</td>
                      <td>${pos.stopLoss?.toFixed(2) || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {riskReport.alerts && riskReport.alerts.length > 0 && (
            <div className="risk-alerts">
              <h3>Risk Alerts</h3>
              <ul>
                {riskReport.alerts.map((alert, idx) => (
                  <li key={idx} className={`alert ${alert.severity}`}>
                    {alert.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="stress-test-section">
        <h3>Stress Testing</h3>
        <button onClick={runStressTest} disabled={loading}>
          Run Stress Test
        </button>
        
        {stressTestResults && (
          <div className="stress-results">
            <h4>Stress Test Results</h4>
            {stressTestResults.scenarios?.map((scenario, idx) => (
              <div key={idx} className="scenario-result">
                <strong>{scenario.name}:</strong>
                <span> Portfolio Impact: {scenario.impact?.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
