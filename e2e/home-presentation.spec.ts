import { expect, test, type Locator, type Page } from '@playwright/test';
import { composite, contrastRatio, parseCssColor } from './color';
import { pngPixel, pngSize } from './png';
import { seedOpenAILikeMock } from './seed';

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((next) => {
    localStorage.setItem('bolt_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-color-theme', next);
  }, theme);
}

async function pillContrast(pill: Locator): Promise<number> {
  const styles = await pill.evaluate((element) => {
    const computed = getComputedStyle(element);
    const header = element.closest('header');
    const headerBg = header ? getComputedStyle(header).backgroundColor : 'rgb(10, 10, 15)';

    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      headerBg,
    };
  });

  const fg = parseCssColor(styles.color);
  const bg = composite(parseCssColor(styles.backgroundColor), parseCssColor(styles.headerBg));

  return contrastRatio(fg, bg);
}

test.describe('home presentation', () => {
  test('cost pill text is visible and meets AA contrast in dark and light', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const pill = page.getByTestId('cost-pill');
    await expect(pill).toBeVisible();

    for (const theme of ['dark', 'light'] as const) {
      await setTheme(page, theme);
      await expect(pill).toHaveText(/\$0\.00/);

      const text = (await pill.innerText()).trim();
      expect(text.length, `${theme} pill text`).toBeGreaterThan(0);

      const ratio = await pillContrast(pill);
      expect(ratio, `${theme} pill contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('aurora is a full-bleed atmosphere behind the empty home column', async ({ page }) => {
    await seedOpenAILikeMock(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const main = page.getByTestId('home-main');
    const aurora = page.getByTestId('home-aurora');
    await expect(aurora).toBeVisible();

    const mainBox = await main.boundingBox();
    const auroraBox = await aurora.boundingBox();
    expect(mainBox, 'home column box').toBeTruthy();
    expect(auroraBox, 'aurora box').toBeTruthy();

    expect((auroraBox?.width ?? 0) / (mainBox?.width ?? 1)).toBeGreaterThanOrEqual(0.95);
    expect((auroraBox?.height ?? 0) / (mainBox?.height ?? 1)).toBeGreaterThanOrEqual(0.95);

    const background = await aurora.locator('.hype-aurora__layer').evaluate((element) => {
      const computed = getComputedStyle(element);
      return `${computed.backgroundImage} ${computed.backgroundColor}`;
    });
    expect(background).toMatch(/radial-gradient/i);

    for (const theme of ['dark', 'light'] as const) {
      await setTheme(page, theme);
      const shot = await main.screenshot();
      const { width, height } = pngSize(shot);
      const sample = pngPixel(shot, Math.round(width * 0.3), Math.round(height * 0.72));
      const base = theme === 'dark' ? { r: 10, g: 10, b: 15 } : { r: 250, g: 250, b: 247 };
      const delta = Math.abs(sample.r - base.r) + Math.abs(sample.g - base.g) + Math.abs(sample.b - base.b);
      expect(delta, `${theme} aurora pixel at 30%/72% (${sample.r},${sample.g},${sample.b})`).toBeGreaterThan(12);
    }
  });
});
