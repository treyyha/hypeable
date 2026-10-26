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
});
