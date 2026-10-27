import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY, waitForHomeHydrated } from './seed';

test.describe('first-run polish', () => {
  test('first HTML includes the inline card and hero, not a covering dialog', async ({ page, request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('Start in 60 seconds');
    expect(html).toContain('data-testid="start-in-sixty"');
    expect(html).toContain('What do you want to');
    expect(html).not.toContain('Welcome to Hypeable');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /What do you want to/i })).toBeVisible();
    const card = page.getByTestId('start-in-sixty');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('connect-openrouter').first()).toBeVisible();
    await expect(page.getByTestId('already-have-key')).toBeVisible();
    expect(await card.evaluate((el) => Boolean(el.closest('[role="dialog"]')))).toBe(false);
  });

  test('dismissing the card remembers in localStorage and sets no cookie', async ({ page, context }) => {
    await page.goto('/');
    await waitForHomeHydrated(page);
    await expect(page.getByTestId('start-in-sixty')).toBeVisible();
    await page.getByTestId('dismiss-start-in-sixty').click();
    await expect(page.getByTestId('start-in-sixty')).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), ONBOARDING_COMPLETED_KEY)).toBe('true');

    const cookies = await context.cookies();
    expect(
      cookies.filter((cookie) => /onboard|bolt_onboarding|hypeable_api/i.test(cookie.name)),
      cookies.map((cookie) => cookie.name).join(','),
    ).toEqual([]);

    await page.reload();
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await expect(page.getByTestId('start-in-sixty')).toBeHidden();
  });

  test('Escape dismisses the card without a focus trap', async ({ page }) => {
    await page.goto('/');
    await waitForHomeHydrated(page);
    await page.getByTestId('connect-openrouter').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('start-in-sixty')).toBeHidden();
    await expect(page.locator('#composer')).toBeVisible();
    await page.locator('#composer').focus();
    await expect(page.locator('#composer')).toBeFocused();
  });

  test('first-visit home has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('start-in-sixty')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test('example chips fill the composer and the shortcut hint is visible', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await waitForHomeHydrated(page);

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
    await waitForHomeHydrated(page);
    await expect(page.getByTestId('example-prompts')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Keys and settings' }).click();
    await page.getByRole('button', { name: 'Connectors' }).click({ timeout: 20_000 });
    await expect(page.getByText('Experimental').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Features' }).click();
    await expect(page.getByText(/Main Branch Updates/i)).toHaveCount(0);
  });
});
