import { expect, test } from '@playwright/test';
import { collectRequestOrigins, forbiddenOrigins } from './external-origins';
import { seedOpenAILikeMock } from './seed';

test.describe('network origins', () => {
  test('first load of / does not phone home or load analytics', async ({ page }) => {
    const origins = collectRequestOrigins(page);
    await seedOpenAILikeMock(page);
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await page.waitForTimeout(1_500);

    const hits = forbiddenOrigins(origins);
    expect(hits, `first-load origins: ${[...origins].sort().join(', ')}`).toEqual([]);
  });

  test('Spend page does not phone home or load analytics', async ({ page }) => {
    const origins = collectRequestOrigins(page);
    await seedOpenAILikeMock(page);
    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);

    const hits = forbiddenOrigins(origins);
    expect(hits, `spend origins: ${[...origins].sort().join(', ')}`).toEqual([]);
  });
});
