import React, { useEffect, useState } from 'react';

export default function AIInsights() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [command, setCommand] = useState('');
  const [symbols, setSymbols] = useState('AAPL,GOOGL,MSFT');

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/insights');
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeMarket = async () => {
    if (!symbols.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbols: symbols.split(',').map(s => s.trim()),
          command 
        })
      });
      if (!response.ok) throw new Error('Failed to analyze market');
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error analyzing market:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <section className="ai-insights">
      <h2>AI Insights & Command Bar</h2>
      
      <div className="command-bar">
        <input
          type="text"
          placeholder="Enter symbols (comma-separated)"
          value={symbols}
          onChange={(e) => setSymbols(e.target.value)}
          className="symbols-input"
        />
        <input
          type="text"
          placeholder="Ask AI for analysis..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && analyzeMarket()}
          className="command-input"
        />
        <button onClick={analyzeMarket} disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {loading && <p>Loading insights...</p>}
      
      {insights && (
        <div className="insights-content">
          {insights.analysis && (
            <div className="analysis">
              <h3>Market Analysis</h3>
              <p>{insights.analysis}</p>
            </div>
          )}
          
          {insights.recommendations && (
            <div className="recommendations">
              <h3>Recommendations</h3>
              <ul>
                {insights.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          
          {insights.opportunities && (
            <div className="opportunities">
              <h3>Trading Opportunities</h3>
              {insights.opportunities.map((opp, idx) => (
                <div key={idx} className="opportunity">
                  <strong>{opp.symbol}</strong>: {opp.action} - {opp.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
