import { copyFileSync, mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { API_KEYS_STORAGE_KEY, seedOpenAILikeMock } from './seed';

const CAPTURE = process.env.CAPTURE_DOCS === '1';
const MOCK_ORIGIN = 'http://127.0.0.1:8788';

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });

test.describe('docs demos', () => {
  test.skip(!CAPTURE, 'set CAPTURE_DOCS=1 to record docs/assets demo clips');

  test.afterEach(async ({ page }, testInfo) => {
    const dest = testInfo.annotations.find((row) => row.type === 'clip')?.description;

    if (!dest) {
      return;
    }

    const video = page.video();
    await page.close();

    if (!video) {
      throw new Error(`no video for ${dest}`);
    }

    const src = await video.path();
    mkdirSync('docs/assets', { recursive: true });
    copyFileSync(src, dest);
  });

  test('live cost pill during a build', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'clip', description: 'docs/assets/demo-cost-pill.webm' });
    test.setTimeout(120_000);
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();

    const textarea = page.locator('textarea').first();
    await textarea.fill('make a todo app');
    await textarea.press('Enter');

    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });
    await plan.getByRole('button', { name: 'Approve & build' }).click();

    const costPill = page.getByRole('button', { name: /Session spend/i });
    await expect(costPill).not.toHaveText(/\$0\.000/, { timeout: 45_000 });
    await page.waitForTimeout(1_200);
  });

  test('plan card', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'clip', description: 'docs/assets/demo-plan-card.webm' });
    test.setTimeout(90_000);
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();

    const textarea = page.locator('textarea').first();
    await textarea.fill('make a todo app');
    await textarea.press('Enter');

    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(1_500);
  });

  test('loop breaker', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'clip', description: 'docs/assets/demo-loop-breaker.webm' });
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?debugLoop=1');
    await expect(page.getByRole('status')).toContainText('Same error, looping', { timeout: 15_000 });
    await page.waitForTimeout(1_500);
  });

  test('spend page', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'clip', description: 'docs/assets/demo-spend.webm' });
    await seedOpenAILikeMock(page);
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem(
        'hypeable:spend-ledger:v1',
        JSON.stringify({
          version: 1,
          entries: [
            {
              id: 'demo-1',
              timestamp: now - 3_600_000,
              chatName: 'Habit tracker',
              model: 'mock-model',
              provider: 'OpenAILike',
              promptTokens: 4200,
              completionTokens: 1800,
              dollars: 0.42,
              verified: true,
            },
          ],
        }),
      );
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Habit tracker')).toBeVisible();
    await page.waitForTimeout(1_800);
  });

  test('connect with OpenRouter', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'clip', description: 'docs/assets/demo-openrouter.webm' });
    test.setTimeout(90_000);
    await routeOpenRouterThroughMock(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.getByTestId('start-in-sixty')).toBeVisible();
    await page.waitForTimeout(600);
    await page.getByTestId('connect-openrouter').click();
    await expect(page.getByText('Connected to OpenRouter. The key stays in this browser.')).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(1_200);
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), API_KEYS_STORAGE_KEY)).toBeTruthy();
  });
});

async function routeOpenRouterThroughMock(page: Page) {
  await page.route(/https:\/\/openrouter\.ai\/.*/, async (route) => {
    const incoming = new URL(route.request().url());
    const mockUrl = `${MOCK_ORIGIN}${incoming.pathname}${incoming.search}`;
    const headers = { ...route.request().headers() };
    delete headers.host;

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
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
      body: await response.text(),
    });
  });
}
