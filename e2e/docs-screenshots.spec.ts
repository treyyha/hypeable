import { expect, test, type Page } from '@playwright/test';
import { seedOpenAILikeMock, waitForChatReady } from './seed';

const CAPTURE = process.env.CAPTURE_DOCS === '1';

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate((next) => {
    localStorage.setItem('bolt_theme', next);
    const apply = (window as Window & { __hypeableSetTheme?: (value: string) => void }).__hypeableSetTheme;

    if (typeof apply === 'function') {
      apply(next);
    } else {
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.setAttribute('data-color-theme', next);
    }
  }, theme);
  await page.waitForTimeout(50);
}

test.describe('docs screenshots', () => {
  test.skip(!CAPTURE, 'set CAPTURE_DOCS=1 to regenerate docs/assets shots');

  test('home and started chat at 375, 768, and 1440', async ({ page }) => {
    test.setTimeout(120_000);
    await seedOpenAILikeMock(page);

    for (const [width, height] of [
      [375, 812],
      [768, 1024],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
      await setTheme(page, 'dark');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/assets/home-dark-${width}.png` });
      await setTheme(page, 'light');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/assets/home-light-${width}.png` });

      await page.goto('/?debugStarted=1');
      await expect(page.locator('[data-testid="home-main"]')).toBeVisible({ timeout: 20_000 });
      await setTheme(page, 'dark');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/assets/chat-dark-${width}.png` });
      await setTheme(page, 'light');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/assets/chat-light-${width}.png` });
    }
  });

  test('home, plan, cost, loop at desktop and mobile', async ({ page }) => {
    test.setTimeout(180_000);
    await seedOpenAILikeMock(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Model and key' })).toBeVisible({ timeout: 20_000 });

    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/home-dark-1440.png' });

    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/home-light-1440.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/home-dark-390.png' });

    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/home-light-390.png' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await setTheme(page, 'dark');
    await page.locator('textarea').first().fill('make a todo app');
    await page.locator('textarea').first().press('Enter');

    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });
    await plan.screenshot({ path: 'docs/assets/plan-card-1440.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await plan.screenshot({ path: 'docs/assets/plan-card-390.png' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: /Session spend/i }).click();
    await expect(page.getByText('By model')).toBeVisible();
    await page.screenshot({ path: 'docs/assets/cost-popover-1440.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/assets/cost-popover-390.png' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?debugLoop=1');
    const loop = page.getByRole('status');
    await expect(loop).toContainText('Same error, looping', { timeout: 15_000 });
    await loop.screenshot({ path: 'docs/assets/loop-panel-1440.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await loop.screenshot({ path: 'docs/assets/loop-panel-390.png' });
  });

  test('spend page at desktop and mobile', async ({ page }) => {
    test.setTimeout(120_000);
    await seedOpenAILikeMock(page);
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem(
        'hypeable:spend-ledger:v1',
        JSON.stringify({
          version: 1,
          entries: [
            {
              id: 'shot-1',
              timestamp: now - 3_600_000,
              chatName: 'Habit tracker',
              model: 'mock-model',
              provider: 'OpenAILike',
              promptTokens: 4200,
              completionTokens: 1800,
              dollars: 0.42,
              verified: true,
            },
            {
              id: 'shot-2',
              timestamp: now - 7_200_000,
              chatName: 'Markdown blog',
              model: 'gpt-4o-mini',
              provider: 'OpenAI',
              promptTokens: 2100,
              completionTokens: 900,
              dollars: 0.18,
              verified: false,
            },
          ],
        }),
      );

      const costRaw = localStorage.getItem('hypeable:cost:v1');
      const cost = costRaw ? JSON.parse(costRaw) : {};
      cost.sessionTotal = 0.42;
      cost.dailyTotal = 0.6;
      cost.byModel = {
        'mock-model': { dollars: 0.42, promptTokens: 4200, completionTokens: 1800 },
        'gpt-4o-mini': { dollars: 0.18, promptTokens: 2100, completionTokens: 900, unverified: true },
      };
      localStorage.setItem('hypeable:cost:v1', JSON.stringify(cost));
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Habit tracker')).toBeVisible();

    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/spend-dark-1440.png' });

    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/spend-light-1440.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/spend-dark-390.png' });

    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/spend-light-390.png' });
  });

  test('start in 60 seconds panel on empty home', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('start-in-sixty')).toBeVisible({ timeout: 20_000 });

    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page
      .locator('[data-testid="start-in-sixty"]')
      .screenshot({ path: 'docs/assets/start-in-sixty-dark-1440.png' });

    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page
      .locator('[data-testid="start-in-sixty"]')
      .screenshot({ path: 'docs/assets/start-in-sixty-light-1440.png' });

    await page.setViewportSize({ width: 375, height: 812 });
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page
      .locator('[data-testid="start-in-sixty"]')
      .screenshot({ path: 'docs/assets/start-in-sixty-dark-375.png' });

    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page
      .locator('[data-testid="start-in-sixty"]')
      .screenshot({ path: 'docs/assets/start-in-sixty-light-375.png' });
  });

  test('cost popover, plan, settings, spend at 1440 and 375', async ({ page }) => {
    test.setTimeout(180_000);
    await seedOpenAILikeMock(page);

    for (const [width, height] of [
      [1440, 900],
      [375, 812],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('cost-pill').click();
      await expect(page.getByText('By model')).toBeVisible();

      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await page.waitForTimeout(200);
        await page.screenshot({ path: `docs/assets/home-cost-popover-${theme}-${width}.png` });
      }

      await page.keyboard.press('Escape');
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForChatReady(page);
    await page.locator('textarea').first().fill('make a todo app');
    await page.locator('textarea').first().press('Enter');
    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });

    for (const [width, height] of [
      [1440, 900],
      [375, 812],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await page.waitForTimeout(200);
        await plan.screenshot({ path: `docs/assets/plan-card-${theme}-${width}.png` });
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForChatReady(page);
    await expect(page.getByRole('button', { name: 'Keys and settings' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Keys and settings' }).hover();
    await page.getByRole('button', { name: 'Keys and settings' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Back to project' })).toBeVisible();

    for (const [width, height] of [
      [1440, 900],
      [375, 812],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme);
        await page.waitForTimeout(200);
        await page.screenshot({ path: `docs/assets/settings-${theme}-${width}.png` });
      }
    }

    await page.keyboard.press('Escape');
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem(
        'hypeable:spend-ledger:v1',
        JSON.stringify({
          version: 1,
          entries: [
            {
              id: 'shot-375',
              timestamp: now,
              chatName: 'Habit tracker',
              model: 'mock-model',
              provider: 'OpenAILike',
              promptTokens: 1200,
              completionTokens: 800,
              dollars: 0.42,
              verified: true,
            },
          ],
        }),
      );
    });
    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await page.setViewportSize({ width: 375, height: 812 });
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/spend-dark-375.png' });
    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'docs/assets/spend-light-375.png' });
  });

  test('predeploy modal fail, warn, and clean', async ({ page }) => {
    test.setTimeout(120_000);
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const [kind, file] of [
      ['fail', 'predeploy-fail'],
      ['warn', 'predeploy-warn'],
      ['clean', 'predeploy-clean'],
    ] as const) {
      await page.goto(`/?debugPredeploy=${kind}`);
      await expect(page.getByTestId('predeploy-summary')).toBeVisible({ timeout: 20_000 });

      await setTheme(page, 'dark');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/assets/${file}-dark-1440.png` });

      await setTheme(page, 'light');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/assets/${file}-light-1440.png` });
    }
  });
});
