// API Configuration
const API_CONFIG = {
  // Base URL for API calls
  baseUrl: window.location.origin,
  
  // API Endpoints
  endpoints: {
    portfolio: '/api/portfolio',
    positions: '/api/positions',
    marketData: '/api/market-data',
    signals: '/api/signals',
    auth: {
      login: '/api/auth/login',
      register: '/api/auth/register'
    }
  },
  
  // Update intervals (milliseconds)
  updateIntervals: {
    portfolio: 5000,    // 5 seconds
    marketData: 3000,   // 3 seconds
    signals: 10000      // 10 seconds
  }
};

// Helper function to make API calls
async function fetchAPI(endpoint) {
  try {
    const response = await fetch(API_CONFIG.baseUrl + endpoint);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    return null;
  }
}