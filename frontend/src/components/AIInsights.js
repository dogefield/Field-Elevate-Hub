import React, { useEffect, useState } from 'react';

export default function AIInsights() {
  const [logs, setLogs] = useState([]);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    const eventSource = new EventSource('/mcp-hub/api/ai-stream');
    eventSource.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        setLogs(l => [...l, msg.text]);
      } catch {}
    };
    return () => eventSource.close();
  }, []);

  const ask = () => {
    fetch('/ai-coo/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    })
      .then(res => res.json())
      .then(res => setLogs(l => [...l, res.answer]));
    setQuestion('');
  };

  return (
    <section>
      <h2>AI Insights & Command Bar</h2>
      <div className="log">
        {logs.map((l, i) => (
          <p key={i}>💬 {l}</p>
        ))}
      </div>
      <input value={question} onChange={e => setQuestion(e.target.value)} />
      <button onClick={ask}>Send</button>
    </section>
  );
}
