import React from 'react';
import PortfolioOverview from './components/PortfolioOverview';
import StrategyAnalytics from './components/StrategyAnalytics';
import RiskManagement from './components/RiskManagement';
import AIInsights from './components/AIInsights';
import InvestorPortal from './components/InvestorPortal';
import OpsConsole from './components/OpsConsole';
import AdvancedML from './components/AdvancedML';
import QuickSettings from './components/QuickSettings';

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Field Elevate Hub</h1>
      </header>
      <main>
        <div className="grid">
          <PortfolioOverview />
          <StrategyAnalytics />
          <RiskManagement />
        </div>
        <AIInsights />
        <div className="grid">
          <InvestorPortal />
          <OpsConsole />
          <AdvancedML />
        </div>
        <QuickSettings />
      </main>
    </div>
  );
}
