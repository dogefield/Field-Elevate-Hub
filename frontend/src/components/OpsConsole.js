import React, { useEffect, useState } from 'react';

export default function OpsConsole() {
  const [serviceStatus, setServiceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchServiceStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchServiceStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        setServiceStatus(data);
      }
    } catch (error) {
      console.error('Error fetching service status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return 'green';
      case 'offline':
        return 'red';
      default:
        return 'yellow';
    }
  };

  return (
    <section className="ops-console">
      <h2>Operations Console</h2>
      
      <div className="console-controls">
        <button onClick={fetchServiceStatus} disabled={loading}>
          Refresh Now
        </button>
        <label>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (5s)
        </label>
      </div>

      {loading && !serviceStatus ? (
        <p>Loading service status...</p>
      ) : serviceStatus ? (
        <div className="service-grid">
          {Object.entries(serviceStatus.services || {}).map(([name, info]) => (
            <div key={name} className="service-card">
              <h3>{name.toUpperCase()}</h3>
              <div className={`status-indicator ${getStatusColor(info.status)}`}>
                {info.status}
              </div>
              {info.version && <p>Version: {info.version}</p>}
              {info.error && <p className="error">Error: {info.error}</p>}
              {info.metrics && (
                <div className="service-metrics">
                  {Object.entries(info.metrics).map(([key, value]) => (
                    <div key={key} className="metric">
                      <span>{key}:</span> {value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>Unable to fetch service status</p>
      )}

      <div className="system-info">
        <h3>System Information</h3>
        <p>Last Update: {serviceStatus?.timestamp ? new Date(serviceStatus.timestamp).toLocaleString() : 'N/A'}</p>
        <p>API Gateway: {serviceStatus ? 'Connected' : 'Disconnected'}</p>
      </div>
    </section>
  );
}
