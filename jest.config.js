const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'pages/**/*.{js,ts,tsx}',
    'components/**/*.{js,ts,tsx}',
    'utils/**/*.{js,ts}',
    '!pages/_app.tsx',
    '!pages/_document.tsx',
    '!**/*.d.ts',
  ],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,ts,tsx}',
    '<rootDir>/**/*.test.{js,ts,tsx}',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
