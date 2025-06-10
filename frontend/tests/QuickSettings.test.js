const React = require('react');
const { render, screen, fireEvent } = require('@testing-library/react');
const QuickSettings = require('../src/components/QuickSettings').default;

global.fetch = jest.fn(() => Promise.resolve({}));

afterEach(() => jest.resetAllMocks());

test('deploy sends settings to API', () => {
  render(React.createElement(QuickSettings));
  fireEvent.change(screen.getByLabelText(/Model/), { target: { value: 'gpt-test' } });
  fireEvent.click(screen.getByText(/Deploy Changes/));
  expect(global.fetch).toHaveBeenCalledWith('/ai-coo/api/settings', expect.objectContaining({ method: 'POST' }));
});
