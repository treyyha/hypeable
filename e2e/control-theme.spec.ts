/**
 * Regression: unthemed buttons fall back to ButtonFace, and UnoCSS `/NN` on
 * CSS variables becomes a solid fill. Visit product surfaces and fail on
 * near-white dark fills, AA contrast, or matching text/background.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  colorsEqual,
  composite,
  compositeStack,
  contrastRatio,
  isNearWhite,
  parseCssColor,
  type Rgba,
} from './color';
import { seedOpenAILikeMock, waitForChatReady, waitForHomeHydrated } from './seed';

type Theme = 'dark' | 'light';

type Sample = {
  selector: string;
  color: string;
  backgroundColor: string;
  ancestorBgs: string[];
};

async function setTheme(page: Page, theme: Theme) {
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

  const expectedVar = theme === 'dark' ? '#0a0a0f' : '#fafaf7';
  const expectedRgb = theme === 'dark' ? 'rgb(10, 10, 15)' : 'rgb(250, 250, 247)';

  await expect
    .poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--hype-bg').trim().toLowerCase()),
    )
    .toBe(expectedVar);

  await expect
    .poll(async () => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(expectedRgb);
}

async function collectControls(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('button, [role="button"], a, input'));
    const samples: Sample[] = [];

    const visible = (element: Element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (element.closest('[hidden], .sr-only, [aria-hidden="true"]')) {
        return false;
      }

      if (element instanceof HTMLButtonElement && element.disabled) {
        return false;
      }

      if (element instanceof HTMLInputElement) {
        if (element.disabled) {
          return false;
        }

        const type = element.type;
        if (type === 'checkbox' || type === 'radio' || type === 'range' || type === 'color' || type === 'file' || type === 'hidden') {
          return false;
        }
      }

      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        return false;
      }

      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        return false;
      }

      return true;
    };

    const selectorFor = (element: HTMLElement) => {
      const testId = element.getAttribute('data-testid');
      if (testId) {
        return `[data-testid="${testId}"]`;
      }

      const label = element.getAttribute('aria-label');
      const text = (element.innerText || element.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 48);

      return `${element.tagName.toLowerCase()}${label ? `[aria-label="${label}"]` : ''}${text ? ` "${text}"` : ''}`;
    };

    for (const node of nodes) {
      if (!visible(node) || !(node instanceof HTMLElement)) {
        continue;
      }

      const style = getComputedStyle(node);
      const mask = style.webkitMaskImage || style.maskImage;
      const iconGlyph = Boolean(mask && mask !== 'none');
      const ancestorBgs: string[] = [];
      let parent = node.parentElement;

      while (parent) {
        ancestorBgs.push(getComputedStyle(parent).backgroundColor);
        parent = parent.parentElement;
      }

      samples.push({
        selector: selectorFor(node),
        color: style.color,
        // Uno icons paint currentColor as background-color behind a mask.
        backgroundColor: iconGlyph ? 'rgba(0, 0, 0, 0)' : style.backgroundColor,
        ancestorBgs,
      });
    }

    return samples;
  });
}

function effectiveBackground(sample: Sample, fallback: Rgba): Rgba {
  const layers = [...sample.ancestorBgs].reverse().map((value) => parseCssColor(value));
  const stacked = compositeStack(layers, fallback);

  return composite(parseCssColor(sample.backgroundColor), stacked);
}

function assertSamples(samples: Sample[], theme: Theme, surface: string) {
  const pageFallback = theme === 'dark' ? { r: 10, g: 10, b: 15, a: 1 } : { r: 250, g: 250, b: 247, a: 1 };
  const failures: string[] = [];

  for (const sample of samples) {
    let own: Rgba;
    let fg: Rgba;

    try {
      own = parseCssColor(sample.backgroundColor);
      fg = parseCssColor(sample.color);
    } catch (error) {
      failures.push(`${surface} ${theme} ${sample.selector}: ${String(error)}`);
      continue;
    }

    if (theme === 'dark' && isNearWhite(own)) {
      failures.push(
        `${surface} ${theme} ${sample.selector}: near-white fill ${sample.backgroundColor} (ButtonFace/white)`,
      );
    }

    const bg = effectiveBackground(sample, pageFallback);

    if (colorsEqual(fg, bg)) {
      failures.push(
        `${surface} ${theme} ${sample.selector}: text ${sample.color} equals background ${sample.backgroundColor}`,
      );
    }

    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) {
      failures.push(
        `${surface} ${theme} ${sample.selector}: contrast ${ratio.toFixed(2)} (${sample.color} on ${sample.backgroundColor} → ${bg.r.toFixed(0)},${bg.g.toFixed(0)},${bg.b.toFixed(0)})`,
      );
    }
  }

  expect(failures, failures.join('\n')).toEqual([]);
}

async function assertCurrentSurface(page: Page, theme: Theme, surface: string) {
  const samples = await collectControls(page);
  expect(samples.length, `${surface} ${theme} found controls`).toBeGreaterThan(0);
  assertSamples(samples, theme, surface);
}

async function assertSurface(page: Page, theme: Theme, surface: string) {
  await setTheme(page, theme);
  await assertCurrentSurface(page, theme, surface);
}

test.describe('themed controls', () => {
  test('first-run card in dark and light at 1440 and 375', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 812 });
      await page.goto('/');
      await expect(page.getByTestId('start-in-sixty')).toBeVisible({ timeout: 20_000 });

      for (const theme of ['dark', 'light'] as const) {
        await assertSurface(page, theme, `first-run ${width}`);
      }
    }
  });

  test('home, cost popover, model-and-key, header, sidebar', async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedOpenAILikeMock(page);

    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 812 });
      await page.goto('/');
      await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
      await waitForChatReady(page);

      for (const theme of ['dark', 'light'] as const) {
        await assertSurface(page, theme, `home ${width}`);

        await page.getByTestId('cost-pill').click();
        await expect(page.getByRole('button', { name: 'Copy receipt' })).toBeVisible();
        await assertSurface(page, theme, `cost popover ${width}`);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Model and key' }).click();
        await expect(page.getByText('Model and key')).toBeVisible();
        await assertSurface(page, theme, `model-key ${width}`);
        await page.keyboard.press('Escape');
      }

      if (width === 375) {
        await page.getByTestId('sidebar-toggle').click();
        await expect(page.getByTestId('app-sidebar')).toBeVisible();
        await assertSurface(page, 'dark', 'sidebar 375');
        await page.getByTestId('sidebar-toggle').click();
      }
    }
  });

  test('settings tabs, spend, privacy, terms, 404', async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible({ timeout: 20_000 });
    await waitForHomeHydrated(page);
    await waitForChatReady(page);

    const settingsButton = page.getByRole('button', { name: 'Keys and settings' });
    await settingsButton.hover();
    await settingsButton.click();
    const settingsDialog = page.getByRole('dialog');
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expect(settingsDialog.getByRole('button', { name: 'Back to project' })).toBeVisible({ timeout: 20_000 });

    const tabNames = (await settingsDialog.locator('aside nav button').allTextContents())
      .map((name) => name.trim())
      .filter(Boolean);
    expect(tabNames.length).toBeGreaterThan(3);

    for (const theme of ['dark', 'light'] as const) {
      await setTheme(page, theme);

      for (const label of tabNames) {
        await settingsDialog.getByRole('button', { name: label, exact: true }).click();
        await assertCurrentSurface(page, theme, `settings ${label}`);
      }
    }

    await settingsDialog.getByRole('button', { name: 'Back to project' }).click();

    await page.goto('/spend');
    await expect(page.getByTestId('spend-page')).toBeVisible({ timeout: 20_000 });
    for (const theme of ['dark', 'light'] as const) {
      await assertSurface(page, theme, 'spend');
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await assertSurface(page, 'dark', 'spend 375');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible({ timeout: 20_000 });
    for (const theme of ['dark', 'light'] as const) {
      await assertSurface(page, theme, 'privacy');
    }

    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible({ timeout: 20_000 });
    await assertSurface(page, 'dark', 'terms');

    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 20_000 });
    await assertSurface(page, 'dark', '404');
    await assertSurface(page, 'light', '404');
  });

  test('plan, loop, cap, predeploy, toast', async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedOpenAILikeMock(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForChatReady(page);
    await page.locator('#composer').fill('make a todo app');
    await page.locator('#composer').press('Enter');
    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });
    for (const theme of ['dark', 'light'] as const) {
      await assertSurface(page, theme, 'plan card');
    }

    await page.goto('/?debugLoop=1');
    await expect(page.getByRole('status', { name: 'Same error, looping' })).toBeVisible({ timeout: 15_000 });
    await assertSurface(page, 'dark', 'loop');
    await assertSurface(page, 'light', 'loop');

    await page.goto('/?debugCap=1');
    await expect(page.getByRole('heading', { name: /cap reached/i })).toBeVisible({ timeout: 15_000 });
    await assertSurface(page, 'dark', 'cap modal');
    await assertSurface(page, 'light', 'cap modal');

    await page.goto('/?debugPredeploy=fail');
    await expect(page.getByTestId('predeploy-summary')).toBeVisible({ timeout: 20_000 });
    await assertSurface(page, 'dark', 'predeploy');
    await assertSurface(page, 'light', 'predeploy');

    await page.goto('/?debugStarted=1&debugDeploy=1');
    await waitForChatReady(page);
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible({ timeout: 20_000 });
    await assertSurface(page, 'dark', 'deploy');
    await assertSurface(page, 'light', 'deploy');

    await page.goto('/');
    await waitForChatReady(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('cost-pill').click();
    await page.getByRole('button', { name: 'Copy receipt' }).click();
    await expect(page.locator('.Toastify__toast')).toBeVisible({ timeout: 10_000 });
    await assertSurface(page, 'dark', 'toast');
  });
});
