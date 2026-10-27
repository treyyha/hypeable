import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY } from './seed';

test.describe('branded error pages', () => {
  test('html has lang and a noscript message; unknown URLs show the 404', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);

    const home = await page.goto('/');
    const html = (await home?.text()) ?? '';
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toContain('Hypeable needs JavaScript to build apps in your browser.');

    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
    await expect(page).toHaveTitle(/Not found/);
  });
});
