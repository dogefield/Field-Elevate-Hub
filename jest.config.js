module.exports = {
  testEnvironment: 'node',
  // testMatch: ['<rootDir>/tests/api/**/*.test.js'], // Allowing command-line --testPathPatterns to take precedence
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['server.js'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'coverage', outputName: 'junit.xml' }]
  ]
};
