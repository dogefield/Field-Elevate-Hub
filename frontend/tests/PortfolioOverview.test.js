const React = require('react');
const { render, screen, waitFor } = require('@testing-library/react');
const PortfolioOverview = require('../src/components/PortfolioOverview').default;

global.fetch = jest.fn(() => Promise.resolve({
  json: () => Promise.resolve({ totalValue: 100, dayChange: 1, positions: 2 })
}));

afterEach(() => jest.resetAllMocks());

test('renders portfolio values', async () => {
  render(React.createElement(PortfolioOverview));
  await waitFor(() => screen.getByText(/Total Value/));
  expect(screen.getByText(/Total Value: \$100/)).toBeInTheDocument();
});
