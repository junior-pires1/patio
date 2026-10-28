/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts', '!src/servidor.ts'],
  coverageThreshold: { global: { statements: 80, branches: 70, functions: 80, lines: 80 } },
};
