import { expect, test, type Page } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock, waitForChatStarted } from './seed';

const VIEWPORTS = [
  { width: 375, height: 812, name: '375' },
  { width: 768, height: 1024, name: '768' },
  { width: 1024, height: 768, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
] as const;

async function sidebarOnScreen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="app-sidebar"]');

    if (!(el instanceof HTMLElement)) {
      return false;
    }

    const style = getComputedStyle(el);

    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const box = el.getBoundingClientRect();
    return box.width > 8 && box.right > 8 && box.left < window.innerWidth - 8;
  });
}

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
  test('home and started chat have no horizontal scroll at 375, 768, 1024, and 1440', async ({ page }) => {
    test.setTimeout(180_000);
    await seedOpenAILikeMock(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
      await assertNoHorizontalScroll(page);

      await page.goto('/?debugStarted=1');
      await waitForChatStarted(page);
      await expect(page.locator('[data-testid="home-main"]')).toBeVisible({ timeout: 20_000 });
      await assertNoHorizontalScroll(page);

      if (viewport.width < 1024) {
        await expect(page.getByTestId('mobile-pane-tabs')).toBeVisible({ timeout: 20_000 });
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

  test('hamburger is hidden at ≥1024 and opens the sidebar at 375 and 768', async ({ page }) => {
    test.setTimeout(180_000);
    await seedOpenAILikeMock(page);

    for (const path of ['/', '/spend'] as const) {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(path);
        await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();

        if (path === '/spend') {
          await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
        } else {
          await expect(page.getByTestId('cost-pill')).toBeVisible({ timeout: 20_000 });
        }

        const toggle = page.getByTestId('sidebar-toggle');

        if (viewport.width >= 1024) {
          await expect(toggle).toBeHidden();
          await expect.poll(() => sidebarOnScreen(page), { timeout: 15_000 }).toBe(true);
          continue;
        }

        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(() => sidebarOnScreen(page), { timeout: 15_000 }).toBe(false);
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(toggle).toBeVisible();
        await expect.poll(() => sidebarOnScreen(page), { timeout: 15_000 }).toBe(true);
        await expect(page.getByRole('link', { name: 'New build' }).last()).toBeVisible();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(() => sidebarOnScreen(page), { timeout: 15_000 }).toBe(false);
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
