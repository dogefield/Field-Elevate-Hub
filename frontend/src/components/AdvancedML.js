import React, { useEffect, useState } from 'react';

export default function AdvancedML() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/ai-coo/api/ml-status')
      .then(res => res.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2>Advanced ML</h2>
      {status ? (
        <p>Predictive Model: {status.model}</p>
      ) : (
        <p>Loading...</p>
      )}
    </section>
  );
}
