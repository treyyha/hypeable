import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { seedOpenAILikeMock, waitForChatStarted, waitForHomeHydrated } from './seed';

const WIDTHS = [375, 768, 1024, 1440] as const;
const THEMES = ['dark', 'light'] as const;
const SHOT_DIR = join('test-results', 'responsive');

type RouteShot = {
  id: string;
  path: string;
  ready: (page: Page) => Promise<void>;
};

const PAGES: RouteShot[] = [
  {
    id: 'home',
    path: '/',
    ready: async (page) => {
      await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('cost-pill')).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    id: 'chat',
    path: '/?debugStarted=1',
    ready: async (page) => {
      await waitForChatStarted(page);
      await expect(page.locator('[data-testid="home-main"]')).toBeVisible({ timeout: 20_000 });
      const width = page.viewportSize()?.width ?? 0;

      if (width < 1024) {
        await expect(page.getByTestId('mobile-pane-tabs')).toBeVisible({ timeout: 20_000 });
      }
    },
  },
  {
    id: 'spend',
    path: '/spend',
    ready: async (page) => {
      await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    id: 'privacy',
    path: '/privacy',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    id: 'terms',
    path: '/terms',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    id: '404',
    path: '/this-page-does-not-exist',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 20_000 });
    },
  },
];

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((next) => {
    localStorage.setItem('bolt_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-color-theme', next);
  }, theme);
}

test.describe('responsive screenshots', () => {
  test('home, started chat, Spend, Privacy, Terms, and 404 at 375–1440 in both themes', async ({ page }) => {
    test.setTimeout(240_000);
    await seedOpenAILikeMock(page);
    mkdirSync(SHOT_DIR, { recursive: true });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 812 });

      for (const route of PAGES) {
        await page.goto(route.path);
        await route.ready(page);

        if (route.id === 'home' || route.id === 'chat') {
          await waitForHomeHydrated(page);
        }

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.scrollWidth, `${route.id} @ ${width}: horizontal overflow`).toBeLessThanOrEqual(
          overflow.clientWidth + 1,
        );

        for (const theme of THEMES) {
          await setTheme(page, theme);
          await page.screenshot({ path: join(SHOT_DIR, `${route.id}-${theme}-${width}.png`), fullPage: false });
        }
      }
    }
  });
});
