import { defineConfig, devices } from '@playwright/test';

/**
 * Hosted-mode smoke plus the adversarial suite in tests/security/*.pw.ts.
 * The webServer must see HYPEABLE_HOSTED=1 so the root loader and API guards
 * match the public deployment.
 *
 * SECURITY_BASE_URL points the run at an already-running hosted build (for
 * example `vite preview` with HYPEABLE_HOSTED=1) and skips the dev server.
 */
const external = process.env.SECURITY_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/hosted.spec.ts', 'tests/security/**/*.pw.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-hosted' }]] : 'list',
  use: {
    baseURL: external ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: external
    ? undefined
    : {
        command: 'pnpm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          ...process.env,
          HYPEABLE_HOSTED: '1',
          CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
        },
      },
});
