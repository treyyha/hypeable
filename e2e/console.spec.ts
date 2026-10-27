import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './console';
import { seedOpenAILikeMock, waitForChatReady } from './seed';

test.describe('clean console', () => {
  test('first load of / has no console errors, warnings, or failed requests', async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await page.waitForTimeout(1_500);
    guard.assertClean();
  });

  test('first load of /spend has no console errors, warnings, or failed requests', async ({ page }) => {
    const guard = attachConsoleGuard(page);
    await seedOpenAILikeMock(page);
    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    guard.assertClean();
  });

  test('mocked plan-and-build leaves the console clean', async ({ page }) => {
    test.setTimeout(120_000);
    const guard = attachConsoleGuard(page);
    await seedOpenAILikeMock(page);
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await waitForChatReady(page);

    const textarea = page.locator('textarea').first();
    await textarea.fill('make a todo app');
    await textarea.press('Enter');

    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });
    await plan.getByRole('button', { name: 'Approve & build' }).click();
    await expect(page.getByText("I'll create a small todo app.")).toBeVisible({ timeout: 45_000 });
    guard.assertClean();
  });
});
