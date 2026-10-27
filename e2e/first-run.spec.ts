import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY } from './seed';

test.describe('first-run polish', () => {
  test('example chips fill the composer and the shortcut hint is visible', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();

    const chip = page.getByTestId('example-prompts').getByRole('button').first();
    const label = (await chip.textContent())?.trim() ?? '';
    expect(label.length).toBeGreaterThan(0);
    await chip.click();
    await expect(page.locator('textarea').first()).toHaveValue(label);
    await expect(page.getByTestId('composer-shortcut-hint')).toBeVisible();
  });

  test('connectors tab labels publish as experimental', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await page.getByRole('button', { name: 'Keys and settings' }).click();
    await expect(page.getByText('Control Panel')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Connectors' }).click();
    await expect(page.getByText('Experimental').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Features' }).click();
    await expect(page.getByText(/Main Branch Updates/i)).toHaveCount(0);
  });
});
