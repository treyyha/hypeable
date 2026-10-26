import { expect, test, type Page } from '@playwright/test';
import { API_KEYS_STORAGE_KEY, ONBOARDING_COMPLETED_KEY } from './seed';

const MOCK_ORIGIN = 'http://127.0.0.1:8788';
const MOCK_KEY = 'sk-or-e2e-mock';

async function skipOnboarding(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'true');
  }, ONBOARDING_COMPLETED_KEY);
}

async function routeOpenRouterThroughMock(page: Page) {
  await page.route(/https:\/\/openrouter\.ai\/.*/, async (route) => {
    const incoming = new URL(route.request().url());
    const mockUrl = `${MOCK_ORIGIN}${incoming.pathname}${incoming.search}`;
    const headers = { ...route.request().headers() };
    delete headers['host'];

    const response = await fetch(mockUrl, {
      method: route.request().method(),
      headers,
      body: route.request().postData() ?? undefined,
      redirect: 'manual',
    });

    const location = response.headers.get('location');

    if (location) {
      await route.fulfill({
        status: 302,
        headers: { location },
        body: '',
      });
      return;
    }

    await route.fulfill({
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
      body: await response.text(),
    });
  });
}

test.describe('OpenRouter connect', () => {
  test('connects, stores the key in the browser, and disconnects', async ({ page }) => {
    test.setTimeout(90_000);
    await skipOnboarding(page);
    await routeOpenRouterThroughMock(page);

    const leaks: string[] = [];
    page.on('console', (message) => {
      if (message.text().includes(MOCK_KEY) || message.text().includes('mock-or-code')) {
        leaks.push(message.text());
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('start-in-sixty')).toBeVisible();
    await page.getByTestId('connect-openrouter').click();

    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Connected to OpenRouter. The key stays in this browser.')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('start-in-sixty')).toHaveCount(0);

    const stored = await page.evaluate((storageKey) => localStorage.getItem(storageKey), API_KEYS_STORAGE_KEY);
    expect(stored).toContain(MOCK_KEY);
    expect(page.url()).not.toContain('code=');
    expect(leaks, 'console must not print the OpenRouter key or code').toEqual([]);

    await page.getByRole('button', { name: 'Model and key' }).click();
    await expect(page.getByTestId('openrouter-connected')).toContainText('Connected via OpenRouter');
    await page.getByTestId('disconnect-openrouter').click();

    const after = await page.evaluate((storageKey) => localStorage.getItem(storageKey), API_KEYS_STORAGE_KEY);
    expect(after === null || after === '{}' || !after.includes(MOCK_KEY)).toBe(true);
    await expect(page.getByTestId('connect-openrouter').first()).toBeVisible();
  });

  test('failed exchange shows a plain error and the paste fallback', async ({ page }) => {
    test.setTimeout(60_000);
    await skipOnboarding(page);

    await page.route(/https:\/\/openrouter\.ai\/auth.*/, async (route) => {
      const incoming = new URL(route.request().url());
      const callback = incoming.searchParams.get('callback_url');
      const state = incoming.searchParams.get('state') || '';
      const dest = new URL(callback || 'http://localhost:5173/auth/openrouter/callback');
      dest.searchParams.set('code', 'mock-or-fail');

      if (state) {
        dest.searchParams.set('state', state);
      }

      await route.fulfill({ status: 302, headers: { location: dest.toString() }, body: '' });
    });

    await page.route('https://openrouter.ai/api/v1/auth/keys', async (route) => {
      await route.fulfill({
        status: 403,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify({ error: { message: 'Invalid code' } }),
      });
    });

    await page.goto('/');
    await page.getByTestId('connect-openrouter').click();

    await expect(page.getByRole('alert')).toContainText(/Could not connect|Paste a key instead/i, { timeout: 20_000 });
    await expect(page.getByTestId('openrouter-paste-fallback')).toBeVisible();
    expect(page.url()).not.toContain('code=');
    expect(await page.content()).not.toContain('mock-or-fail');
  });
});
