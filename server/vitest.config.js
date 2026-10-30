import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/helpers/setup.js'],
    hookTimeout: 60000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
