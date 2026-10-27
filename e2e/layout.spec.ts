import { expect, test, type Page } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock, waitForChatReady } from './seed';

const VIEWPORTS = [
  { width: 375, height: 812, name: '375' },
  { width: 768, height: 1024, name: '768' },
  { width: 1440, height: 900, name: '1440' },
] as const;

async function assertNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('narrow layout', () => {
  test('home and started chat have no horizontal scroll at 375, 768, and 1440', async ({ page }) => {
    test.setTimeout(120_000);
    await seedOpenAILikeMock(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
      await assertNoHorizontalScroll(page);

      await page.goto('/?debugStarted=1');
      await waitForChatReady(page);
      await expect(page.locator('[data-testid="home-main"]')).toBeVisible({ timeout: 20_000 });
      await assertNoHorizontalScroll(page);

      if (viewport.width < 1024) {
        await expect(page.getByTestId('mobile-pane-tabs')).toBeVisible();
        await page.getByTestId('mobile-pane-code').click();
        await assertNoHorizontalScroll(page);
        await page.getByTestId('mobile-pane-preview').click();
        await assertNoHorizontalScroll(page);
        await page.getByTestId('mobile-pane-chat').click();
        await assertNoHorizontalScroll(page);
      } else {
        await expect(page.getByTestId('mobile-pane-tabs')).toBeHidden();
      }
    }
  });

  test('prefers-reduced-motion stops the aurora animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await expect(page.getByTestId('home-aurora')).toBeVisible();

    const duration = await page
      .locator('.hype-aurora__layer')
      .first()
      .evaluate((el) => {
        return getComputedStyle(el).animationDuration;
      });

    expect(duration === '0s' || duration === '0ms').toBe(true);
  });

  test('keyboard can reach the composer from the skip link', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);
    await page.goto('/');
    await expect(page.locator('#composer')).toBeVisible({ timeout: 20_000 });

    const skip = page.getByRole('link', { name: 'Skip to composer' });
    await page.locator('body').press('Tab');

    for (let i = 0; i < 12; i += 1) {
      if (await skip.evaluate((el) => el === document.activeElement)) {
        break;
      }

      await page.keyboard.press('Tab');
    }

    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#composer')).toBeFocused();
  });
});
