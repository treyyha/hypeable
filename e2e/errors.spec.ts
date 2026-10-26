import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock } from './seed';

async function sendFromHome(page: import('@playwright/test').Page) {
  const composer = page.locator('#composer');
  await expect(composer).toBeVisible({ timeout: 20_000 });
  await composer.fill('make a todo app');
  await composer.press('Enter');
}

test.describe('user-facing error states', () => {
  test('no key shows a specific add-a-key message', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);

    await page.goto('/');
    await sendFromHome(page);
    await expect(page.getByText('Add an API key')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/paste a key/i)).toBeVisible();
  });

  test('401 shows an invalid-key message', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: true,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
          provider: 'OpenAILike',
        }),
      });
    });

    await page.goto('/');
    await sendFromHome(page);
    await expect(page.getByText('That key was rejected')).toBeVisible({ timeout: 20_000 });
  });

  test('402 shows a no-credit message', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: true,
          message: 'Insufficient credits',
          statusCode: 402,
          isRetryable: false,
          provider: 'OpenAILike',
        }),
      });
    });

    await page.goto('/');
    await sendFromHome(page);
    await expect(page.getByText('No credit left')).toBeVisible({ timeout: 20_000 });
  });

  test('503 shows a provider-down message', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: true,
          message: 'Service unavailable',
          statusCode: 503,
          isRetryable: true,
          provider: 'OpenAILike',
        }),
      });
    });

    await page.goto('/');
    await sendFromHome(page);
    await expect(page.getByText('The provider did not respond')).toBeVisible({ timeout: 20_000 });
  });

  test('429 shows a rate-limit message', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: true,
          message: 'Too many requests. Wait a minute, then try again.',
          statusCode: 429,
          isRetryable: true,
          provider: 'hypeable',
        }),
      });
    });

    await page.goto('/');
    await sendFromHome(page);
    await expect(page.getByText('Too many requests')).toBeVisible({ timeout: 20_000 });
  });

  test('offline shows a connection message', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.goto('/');
    await expect(page.locator('#composer')).toBeVisible({ timeout: 20_000 });
    await page.context().setOffline(true);
    await sendFromHome(page);
    await expect(page.getByText('You look offline')).toBeVisible({ timeout: 15_000 });
  });

  test('cost cap modal is friendly', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.addInitScript(() => {
      const raw = localStorage.getItem('hypeable:cost:v1');
      const cost = raw ? JSON.parse(raw) : {};
      cost.sessionTotal = 2;
      cost.caps = { session: 2, daily: 10 };
      localStorage.setItem('hypeable:cost:v1', JSON.stringify(cost));
    });

    await page.goto('/');
    await sendFromHome(page);
    await expect(page.getByText(/cap reached/i)).toBeVisible({ timeout: 20_000 });
  });

  test('loop breaker panel appears from debugLoop', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.goto('/?debugLoop=1');
    await expect(page.getByRole('status')).toContainText('Same error, looping', { timeout: 15_000 });
  });

  test('unsupported browser banner from debugBrowser', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/?debugBrowser=1');
    await expect(page.getByTestId('browser-support-banner')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Chrome or Edge/i)).toBeVisible();
  });
});
