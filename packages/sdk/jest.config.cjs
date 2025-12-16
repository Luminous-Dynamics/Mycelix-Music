/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  watchman: false,
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.(spec|test).[tj]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverage: false,
};
