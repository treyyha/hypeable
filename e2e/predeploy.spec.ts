import { expect, test } from '@playwright/test';
import { seedOpenAILikeMock } from './seed';

test.describe('Pre-deploy modal', () => {
  test('opens a FAIL report from a seeded vulnerable file set', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.goto('/?debugPredeploy=fail');
    await expect(page.getByText('Publish blocked')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('predeploy-summary')).toContainText('fail');
    await expect(page.getByTestId('predeploy-risk')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish anyway' })).toBeDisabled();
    await page.getByTestId('predeploy-risk').check();
    await expect(page.getByRole('button', { name: 'Publish anyway' })).toBeEnabled();
  });
});
