import { expect, test, type Page } from '@playwright/test';
import { seedOpenAILikeMock } from './seed';

const CAPTURE = process.env.CAPTURE_DOCS === '1';

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((next) => {
    localStorage.setItem('bolt_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-color-theme', next);
  }, theme);
}

test.describe('docs screenshots', () => {
  test.skip(!CAPTURE, 'set CAPTURE_DOCS=1 to regenerate docs/assets shots');

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
});
