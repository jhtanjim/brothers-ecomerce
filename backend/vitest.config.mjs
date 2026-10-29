import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    // Integration tests share one database, so test files run one after another.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
