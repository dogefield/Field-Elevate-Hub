import React, { useEffect, useState } from 'react';

export default function OpsConsole() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/mcp-hub/api/status')
      .then(res => res.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Ops Console</h2>
      {status ? (
        <ul>
          {Object.entries(status).map(([k, v]) => (
            <li key={k}>{k}: {v ? 'Online' : 'Offline'}</li>
          ))}
        </ul>
      ) : (
        <p>Loading...</p>
      )}
    </section>
  );
}
