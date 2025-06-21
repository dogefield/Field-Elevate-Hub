// Bot Concierge Intelligence Module
function getBotResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Price queries
    if ((message.includes('price') || message.includes('cost') || message.includes('worth')) && 
        (message.includes('bitcoin') || message.includes('btc'))) {
        return "Bitcoin (BTC) is currently trading at $43,250.00 (mock data). 24h change: +2.5% ($1,056). The momentum strategy shows strong buy signals.";
    }
    
    if ((message.includes('price') || message.includes('cost')) && 
        (message.includes('ethereum') || message.includes('eth'))) {
        return "Ethereum (ETH) is trading at $2,340.00 (mock data). 24h change: +3.2% ($72.48). ETH/USDT shows potential arbitrage opportunities.";
    }
    
    if ((message.includes('price') || message.includes('cost')) && 
        (message.includes('solana') || message.includes('sol'))) {
        return "Solana (SOL) is at $98.50 (mock data). 24h change: +5.1%. Strong breakout pattern detected with 91% confidence.";
    }
    
    // Portfolio queries
    if (message.includes('portfolio') && (message.includes('value') || message.includes('worth') || message.includes('total'))) {
        return "Your total portfolio value is $1,247,892 with a +12.5% gain in the last 24 hours. You have $50,000 in cash balance and 3 open positions.";
    }
    
    // Risk queries
    if (message.includes('risk') || message.includes('var')) {
        return "Risk Analysis:\n• VaR (95% confidence): $47,230\n• Sharpe Ratio: 2.41\n• Risk Level: MEDIUM (45%)\n• Max Drawdown: -8.3%\nAll risk parameters are within acceptable limits.";
    }
    
    // Strategy queries
    if (message.includes('strateg')) {
        return "Active Strategies (17 total):\n• 5 Momentum strategies\n• 7 Mean Reversion strategies\n• 5 Arbitrage strategies\n\nTop performer: BTC Momentum Alpha (+18.2%)";
    }
    
    // Market/Signal queries
    if (message.includes('signal') || message.includes('recommendation')) {
        return "Latest Trading Signals:\n• BTC: BUY (87% confidence) - RSI oversold\n• ETH: SELL (72% confidence) - Resistance rejection\n• SOL: BUY (91% confidence) - Breakout confirmed\n• AVAX: HOLD (65% confidence) - Consolidation";
    }
    
    // Performance queries
    if (message.includes('performance') || message.includes('profit') || message.includes('gain')) {
        return "Performance Summary:\n• 24h: +$15,624 (+12.5%)\n• 7d: +$47,892 (+3.8%)\n• 30d: +$125,000 (+10.2%)\n• All-time: +$247,892 (+25%)";
    }
    
    // Help queries
    if (message.includes('help') || message.includes('what can')) {
        return "I can help you with:\n• Cryptocurrency prices (BTC, ETH, SOL, etc.)\n• Portfolio value and performance\n• Risk analysis and metrics\n• Trading strategies overview\n• Market signals and recommendations\n• System health status\n\nJust ask me anything!";
    }
    
    // Emergency/Stop queries
    if (message.includes('stop') || message.includes('emergency') || message.includes('halt')) {
        return "⚠️ To execute an EMERGENCY STOP:\n1. Click the red 'EMERGENCY STOP' button in the Trading Panel\n2. Confirm the action\n3. All trading will halt immediately\n\nThis action will stop all active strategies and positions.";
    }
    
    // System health
    if (message.includes('system') || message.includes('health') || message.includes('status')) {
        return "System Health: ✅ All Systems Operational\n• Data Hub: Online (23ms)\n• Signal Forge: Online (12ms)\n• Trade Runner: Online (8ms)\n• Risk Analyzer: Online (31ms)\n• AI COO: Online (42ms)";
    }
    
    // Greeting responses
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return "Hello! I'm your AI trading assistant. I can help you monitor prices, check your portfolio, analyze risks, and review trading strategies. What would you like to know?";
    }
    
    // Default response
    const context = extractContext(message);
    if (context) {
        return `I understand you're asking about ${context}. Try being more specific. For example:\n• "What's the price of Bitcoin?"\n• "Show my portfolio value"\n• "What's my current risk level?"`;
    }
    
    return "I'm not sure I understood that. I can help with:\n• Crypto prices (try: 'Bitcoin price')\n• Portfolio info (try: 'portfolio value')\n• Risk metrics (try: 'risk analysis')\n• Trading signals (try: 'market signals')\n\nWhat would you like to know?";
}

function extractContext(message) {
    const keywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'portfolio', 'risk', 'strategy', 'signal', 'price'];
    for (const keyword of keywords) {
        if (message.includes(keyword)) {
            return keyword;
        }
    }
    return null;
}