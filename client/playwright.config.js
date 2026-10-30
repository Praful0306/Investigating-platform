import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run the REAL server (mock AI, in-memory MongoDB) behind the REAL client dev server, so the whole
// contract is exercised: no mock API in the browser. Needs `npx playwright install chromium` once.
// Locally an already running server on these ports is reused; in CI (CI=true) fresh ones are always started.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1, // one shared in-memory database; the flow tests are quick, so parallelism buys little
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/dev-memory.mjs',
      cwd: '../server',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PORT: '5000', NODE_ENV: 'test', AI_PROVIDERS: 'mock', CLIENT_URL: 'http://localhost:5173' },
    },
    {
      command: 'npm run dev -- --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_USE_MOCK: 'false' },
    },
  ],
});
