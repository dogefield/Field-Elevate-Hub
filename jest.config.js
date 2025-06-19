module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/api/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['server.js'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'coverage', outputName: 'junit.xml' }]
  ]
};
