import type { JestConfigWithTsJest } from 'ts-jest';

/** @type {import('jest').Config} */
const jestConfig: JestConfigWithTsJest = {
  clearMocks: true,
  coverageProvider: "v8",
  preset: "ts-jest",
  globalSetup: './test/services/setup.ts',
  globalTeardown: './test/services/teardown.ts',
  transform: {
    '^.+\\.tsx?$': [
      "ts-jest",
        {
          "compiler": "typescript",
          "isolatedModules": false,
          "diagnostics": true,
          "useESM": true,
        }
    ]
  },
};

export default jestConfig;
