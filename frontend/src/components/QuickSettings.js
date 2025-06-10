import React, { useState } from 'react';

export default function QuickSettings() {
  const [model, setModel] = useState('gpt-4');
  const [temp, setTemp] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);

  const deploy = () => {
    fetch('/ai-coo/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: temp, maxTokens })
    });
  };

  return (
    <section>
      <h2>Quick Settings</h2>
      <div>
        <label>Model
          <input value={model} onChange={e => setModel(e.target.value)} />
        </label>
        <label>Temperature
          <input type="number" value={temp} onChange={e => setTemp(parseFloat(e.target.value))} />
        </label>
        <label>Max Tokens
          <input type="number" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value, 10))} />
        </label>
      </div>
      <button onClick={deploy}>Deploy Changes</button>
    </section>
  );
}
