import { defineConfig, devices } from '@playwright/test';

/**
 * Hosted-mode smoke. The webServer must see HYPEABLE_HOSTED=1 so the root
 * loader and API guards match the public deployment.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'hosted.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-hosted' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      HYPEABLE_HOSTED: '1',
    },
  },
});
