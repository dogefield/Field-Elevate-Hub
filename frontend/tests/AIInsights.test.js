const React = require('react');
const { render } = require('@testing-library/react');
const AIInsights = require('../src/components/AIInsights').default;

global.EventSource = jest.fn(() => ({
  onmessage: null,
  close: jest.fn()
}));

afterEach(() => jest.resetAllMocks());

test('opens EventSource connection', () => {
  render(React.createElement(AIInsights));
  expect(global.EventSource).toHaveBeenCalledWith('/mcp-hub/api/ai-stream');
});
