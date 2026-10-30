import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY } from './seed';

test.describe('privacy and terms', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
  });

  test('privacy states what we collect, cookies, and key flow', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveTitle(/Privacy/);
    await expect(page.getByText(/No accounts and no database/i).first()).toBeVisible();
    await expect(page.getByText(/We have not audited what StackBlitz sees/i)).toBeVisible();
    await expect(page.getByText(/selectedProvider/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'KEY-FLOW.md' })).toBeVisible();
    await expect(page.getByText(/legal advice/i)).toHaveCount(0);
  });

  test('terms cover MIT, estimates, and experimental publish', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveTitle(/Terms/);
    await expect(page.getByText(/MIT licence/i)).toBeVisible();
    await expect(page.getByText(/not invoices/i)).toBeVisible();
    await expect(page.getByText(/experimental/i)).toBeVisible();
    await expect(page.getByText(/legal advice/i)).toHaveCount(0);
  });

  test('footer links to both pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  test('privacy and terms copy is in the HTML without waiting for JS', async ({ request }) => {
    const privacy = await request.get('/privacy');
    expect(privacy.status()).toBe(200);
    const privacyText = await privacy.text();
    expect(privacyText).toContain('selectedProvider');
    expect(privacyText).toContain('No accounts and no database');
    expect(privacyText).toContain('html.duckduckgo.com');
    expect(privacyText).toContain('Cloudflare Worker');
    expect(privacyText).toContain('We have not audited what StackBlitz sees');
    expect(privacyText).not.toMatch(/legal advice/i);

    const terms = await request.get('/terms');
    expect(terms.status()).toBe(200);
    const termsText = await terms.text();
    expect(termsText).toContain('MIT licence');
    expect(termsText).not.toMatch(/legal advice/i);
  });
});
