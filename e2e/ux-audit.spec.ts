/**
 * Visual audit shots. Not part of default CI — set UX_AUDIT=1 to capture.
 * Writes to test-results/ux-audit/<id>-<theme>-<width>x<height>.png
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { OVERFLOW_VIEWPORTS } from './overflow';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock, waitForChatStarted, waitForHomeHydrated } from './seed';

const CAPTURE = process.env.UX_AUDIT === '1';
const SHOT_DIR = join('test-results', 'ux-audit');
const THEMES = ['dark', 'light'] as const;
const SETTINGS_TABS = [
  'Preferences',
  'Profile',
  'Notifications',
  'Features',
  'Data Management',
  'Event Logs',
  'Cloud Providers',
  'Local Providers',
  'Connectors',
  'MCP Servers',
] as const;

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate((next) => {
    localStorage.setItem('bolt_theme', next);
    const apply = (window as Window & { __hypeableSetTheme?: (value: string) => void }).__hypeableSetTheme;

    if (typeof apply === 'function') {
      apply(next);
    } else {
      document.documentElement.setAttribute('data-theme', next);
      document.documentElement.setAttribute('data-color-theme', next);
    }
  }, theme);
  await page.waitForTimeout(60);
}

async function shot(page: Page, id: string, theme: 'dark' | 'light', width: number, height: number) {
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: join(SHOT_DIR, `${id}-${theme}-${width}x${height}.png`),
    fullPage: false,
  });
}

async function eachThemeShot(page: Page, id: string, width: number, height: number) {
  for (const theme of THEMES) {
    await setTheme(page, theme);
    await shot(page, id, theme, width, height);
  }
}

test.describe('ux audit screenshots', () => {
  test.skip(!CAPTURE, 'set UX_AUDIT=1 to capture test-results/ux-audit shots');

  test('home at every listed viewport; other surfaces at 1920, 1280, and 390', async ({ page }) => {
    test.setTimeout(600_000);

    for (const viewport of OVERFLOW_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.getByTestId('start-in-sixty')).toBeVisible({ timeout: 20_000 });
      await waitForHomeHydrated(page);
      await eachThemeShot(page, 'home-first-run', viewport.width, viewport.height);
    }

    await seedOpenAILikeMock(page);

    for (const viewport of OVERFLOW_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.getByTestId('cost-pill')).toBeVisible({ timeout: 20_000 });
      await waitForHomeHydrated(page);
      await eachThemeShot(page, 'home-key-connected', viewport.width, viewport.height);

      await page.evaluate((key) => {
        localStorage.setItem(key, 'true');
        localStorage.removeItem('hypeable_api_keys');
      }, ONBOARDING_COMPLETED_KEY);
      await page.reload();
      await waitForHomeHydrated(page);
      await eachThemeShot(page, 'home-key-missing', viewport.width, viewport.height);
    }

    const rest = OVERFLOW_VIEWPORTS.filter((item) => item.width === 1920 || item.width === 1280 || item.width === 390);

    for (const viewport of rest) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedOpenAILikeMock(page);

      await page.goto('/?debugStarted=1');
      await waitForChatStarted(page);
      await eachThemeShot(page, 'chat-started', viewport.width, viewport.height);

      await page.goto('/?debugLoop=1');
      await expect(page.getByRole('status')).toContainText('Same error, looping', { timeout: 20_000 });
      await eachThemeShot(page, 'loop-panel', viewport.width, viewport.height);

      await page.goto('/?debugCap=1');
      await expect(page.getByText(/cap/i).first()).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'cap-modal', viewport.width, viewport.height);
      await page.keyboard.press('Escape');

      await page.goto('/?debugPredeploy=fail');
      await expect(page.getByTestId('predeploy-summary')).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'predeploy-fail', viewport.width, viewport.height);
      await page.keyboard.press('Escape');

      await page.goto('/?debugStarted=1&debugDeploy=1');
      await waitForChatStarted(page);
      await eachThemeShot(page, 'deploy-alert', viewport.width, viewport.height);

      await page.goto('/');
      await waitForHomeHydrated(page);
      await page.getByTestId('cost-pill').click();
      await expect(page.getByText('By model')).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'cost-popover', viewport.width, viewport.height);
      await page.keyboard.press('Escape');

      await page.getByTestId('model-key-chip').click();
      await expect(page.getByText('Model and key')).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'model-key-popover', viewport.width, viewport.height);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Keys and settings' }).click();
      await expect(page.getByRole('button', { name: 'Back to project' })).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'settings-home', viewport.width, viewport.height);

      if (viewport.width === 1920) {
        for (const tab of SETTINGS_TABS) {
          const tabButton = page.getByRole('button', { name: tab, exact: true });

          if ((await tabButton.count()) === 0) {
            continue;
          }

          await tabButton.click();
          await page.waitForTimeout(80);
          await eachThemeShot(
            page,
            `settings-${tab.toLowerCase().replace(/\s+/g, '-')}`,
            viewport.width,
            viewport.height,
          );
        }
      }

      await page.keyboard.press('Escape');

      await page.goto('/spend');
      await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'spend-empty', viewport.width, viewport.height);

      await page.evaluate(() => {
        localStorage.setItem(
          'hypeable:spend-ledger:v1',
          JSON.stringify({
            version: 1,
            entries: [
              {
                id: 'audit-1',
                timestamp: Date.now(),
                chatName: 'Habit tracker',
                model: 'mock-model',
                provider: 'OpenAILike',
                promptTokens: 1200,
                completionTokens: 800,
                dollars: 0.42,
                verified: true,
              },
            ],
          }),
        );
      });
      await page.goto('/spend');
      await expect(page.getByText('Habit tracker')).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'spend-seeded', viewport.width, viewport.height);

      await page.goto('/privacy');
      await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'privacy', viewport.width, viewport.height);

      await page.goto('/terms');
      await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, 'terms', viewport.width, viewport.height);

      await page.goto('/this-page-does-not-exist');
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 20_000 });
      await eachThemeShot(page, '404', viewport.width, viewport.height);
    }

    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForHomeHydrated(page);
    const composer = page.locator('#composer');
    await composer.fill('make a todo app');
    await composer.press('Enter');
    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });

    for (const viewport of rest) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await eachThemeShot(page, 'plan-card', viewport.width, viewport.height);
    }
  });
});
