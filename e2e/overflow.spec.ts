import { expect, test, type Page } from '@playwright/test';
import { assertHomePrimaryActionsInView, assertSurfaceLayout, OVERFLOW_VIEWPORTS } from './overflow';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock, waitForChatStarted, waitForHomeHydrated } from './seed';

const LEDGER_STORAGE_KEY = 'hypeable:spend-ledger:v1';

async function forEachViewport(page: Page, run: (name: string) => Promise<void>) {
  for (const viewport of OVERFLOW_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(50);
    await run(viewport.name);
  }
}

test.describe('overflow regression', () => {
  test('home, chat, spend, legal, settings, and debug surfaces stay inside their cards', async ({ page }) => {
    test.setTimeout(300_000);
    await seedOpenAILikeMock(page);

    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
    await waitForHomeHydrated(page);

    await forEachViewport(page, async (name) => {
      const label = `home-seeded @ ${name}`;
      await assertSurfaceLayout(page, label, { composer: true });

      if (name === '1280') {
        await assertHomePrimaryActionsInView(page, label);
      }
    });

    await page.getByTestId('cost-pill').click();
    await expect(page.getByText('By model')).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `cost-popover @ ${name}`, { composer: true });
    });
    await page.keyboard.press('Escape');

    await page.getByTestId('model-key-chip').click();
    await expect(page.getByText('Model and key')).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `model-key @ ${name}`, { composer: true });
    });
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Keys and settings' }).click();
    await expect(page.getByRole('button', { name: 'Back to project' })).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `settings @ ${name}`, { composer: false });
    });
    await page.keyboard.press('Escape');

    await page.goto('/?debugStarted=1');
    await waitForChatStarted(page);
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `chat @ ${name}`, { composer: true });
    });

    await page.goto('/?debugLoop=1');
    await expect(page.getByRole('status')).toContainText('Same error, looping', { timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `loop @ ${name}`, { composer: true });
    });

    await page.goto('/?debugCap=1');
    await expect(page.getByText(/cap/i).first()).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `cap @ ${name}`, { composer: false });
    });
    await page.keyboard.press('Escape');

    await page.goto('/?debugPredeploy=fail');
    await expect(page.getByTestId('predeploy-summary')).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `predeploy @ ${name}`, { composer: false });
    });
    await page.keyboard.press('Escape');

    await page.goto('/?debugStarted=1&debugDeploy=1');
    await waitForChatStarted(page);
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `deploy @ ${name}`, { composer: true });
    });

    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `spend-empty @ ${name}`, { composer: false });
    });

    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      {
        key: LEDGER_STORAGE_KEY,
        payload: {
          version: 1,
          entries: [
            {
              id: 'e2e-overflow-1',
              timestamp: Date.parse('2026-10-26T02:00:00Z'),
              chatName: 'Habit tracker',
              model: 'mock-model',
              provider: 'OpenAILike',
              promptTokens: 1200,
              completionTokens: 800,
              dollars: 0.42,
              verified: true,
            },
          ],
        },
      },
    );
    await page.goto('/spend');
    await expect(page.getByText('Habit tracker')).toBeVisible({ timeout: 20_000 });
    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `spend-seeded @ ${name}`, { composer: false });
    });

    for (const [path, ready] of [
      ['/privacy', 'Privacy'],
      ['/terms', 'Terms'],
      ['/this-page-does-not-exist', 'Page not found'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: ready })).toBeVisible({ timeout: 20_000 });
      await forEachViewport(page, async (name) => {
        await assertSurfaceLayout(page, `${ready} @ ${name}`, { composer: false });
      });
    }
  });

  test('first-run home (no key) does not overflow the composer', async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((key) => {
      localStorage.removeItem(key);
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await expect(page.getByTestId('start-in-sixty')).toBeVisible({ timeout: 20_000 });
    await waitForHomeHydrated(page);

    await forEachViewport(page, async (name) => {
      await assertSurfaceLayout(page, `home-first-run @ ${name}`, { composer: true });
      await expect(page.locator('#composer')).toHaveAttribute(
        'placeholder',
        'Describe your app, e.g. a habit tracker with streaks and dark mode',
      );
      await expect(page.getByRole('button', { name: /Plan first/ })).toBeVisible();
    });
  });
});
