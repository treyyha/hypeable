import { defineConfig, devices } from '@playwright/test';

const preview = process.env.E2E_PREVIEW === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['hosted.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'node scripts/dev/mock-openai.mjs',
      url: 'http://127.0.0.1:8787/v1/models',
      // A leftover mock can still return the old "Hello from mock" body.
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node scripts/dev/mock-openrouter.mjs',
      url: 'http://127.0.0.1:8788/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: preview ? 'pnpm run preview' : 'pnpm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: preview ? 300_000 : 180_000,
    },
  ],
});
