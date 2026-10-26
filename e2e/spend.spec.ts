import { expect, test } from '@playwright/test';
import { seedOpenAILikeMock } from './seed';

const LEDGER_STORAGE_KEY = 'hypeable:spend-ledger:v1';

const seededLedger = {
  version: 1,
  entries: [
    {
      id: 'e2e-1',
      timestamp: Date.parse('2026-10-26T02:00:00Z'),
      chatId: 'chat-1',
      chatName: 'Habit tracker',
      model: 'mock-model',
      provider: 'OpenAILike',
      promptTokens: 1200,
      completionTokens: 800,
      dollars: 0.42,
      verified: true,
    },
  ],
};

test.describe('Spend page', () => {
  test('opens /spend after seeding a ledger', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: LEDGER_STORAGE_KEY, payload: seededLedger },
    );

    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Spent today')).toBeVisible();
    await expect(page.getByText('Habit tracker')).toBeVisible();
    await expect(page.getByText('mock-model')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Spend' })).toBeVisible();
  });
});
