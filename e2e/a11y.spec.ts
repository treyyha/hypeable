import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock } from './seed';

async function assertNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

test.describe('axe-core', () => {
  test('home has no serious or critical violations', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await assertNoSeriousAxeViolations(page);
  });

  test('key dialog has no serious or critical violations', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await page.getByRole('button', { name: 'Model and key' }).click();
    await expect(page.getByText(/API key/i).first()).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousAxeViolations(page);
  });

  test('Spend has no serious or critical violations', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousAxeViolations(page);
  });

  test('started chat has no serious or critical violations', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.goto('/?debugStarted=1');
    await expect(page.locator('[data-testid="home-main"]')).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousAxeViolations(page);
  });
});
