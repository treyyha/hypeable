import { expect, type Page } from '@playwright/test';

export const OVERFLOW_VIEWPORTS = [
  { width: 1920, height: 1080, name: '1920' },
  { width: 1600, height: 900, name: '1600' },
  { width: 1440, height: 900, name: '1440' },
  { width: 1280, height: 720, name: '1280' },
  { width: 1024, height: 768, name: '1024' },
  { width: 768, height: 1024, name: '768' },
  { width: 390, height: 844, name: '390' },
] as const;

export async function assertNoHorizontalPageScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.scrollWidth, `${label}: horizontal page scroll`).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

type ContainViolation = { tag: string; testId: string; left: number; right: number; rootRight: number; rootLeft: number };
type TextViolation = { text: string; tag: string; scrollWidth: number; clientWidth: number };

export async function assertContainedInCards(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const visible = (el: Element) => {
      if (!(el instanceof HTMLElement)) {
        return false;
      }

      const style = getComputedStyle(el);

      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        return false;
      }

      const box = el.getBoundingClientRect();

      return box.width >= 8 && box.height >= 8;
    };

    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible);
    const topDialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
    const scope = topDialog ?? document;
    const roots = Array.from(scope.querySelectorAll('[data-contain], .hype-composer')).filter(visible);

    if (topDialog instanceof HTMLElement) {
      roots.unshift(topDialog);
    }

    const bad: ContainViolation[] = [];
    const seen = new Set<HTMLElement>();

    for (const root of roots) {
      if (!(root instanceof HTMLElement) || seen.has(root)) {
        continue;
      }

      seen.add(root);

      const rootBox = root.getBoundingClientRect();

      for (const child of root.querySelectorAll('*')) {
        if (!(child instanceof HTMLElement)) {
          continue;
        }

        const nearest = child.closest('[data-contain], [role="dialog"], .hype-composer');

        if (nearest !== root) {
          continue;
        }

        const style = getComputedStyle(child);

        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.position === 'fixed' ||
          style.position === 'absolute' ||
          child.classList.contains('hype-switch__thumb')
        ) {
          continue;
        }

        const box = child.getBoundingClientRect();

        if (box.width < 1 || box.height < 1) {
          continue;
        }

        if (box.left < rootBox.left - 2.5 || box.right > rootBox.right + 2.5) {
          bad.push({
            tag: child.tagName.toLowerCase(),
            testId: child.getAttribute('data-testid') || child.className.toString().slice(0, 80),
            left: Math.round(box.left),
            right: Math.round(box.right),
            rootLeft: Math.round(rootBox.left),
            rootRight: Math.round(rootBox.right),
          });
        }
      }
    }

    return bad.slice(0, 12);
  });

  expect(violations, `${label}: children overflow card/dialog ${JSON.stringify(violations)}`).toEqual([]);
}

export async function assertTextEllipsisHasTooltip(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('p, span, h1, h2, h3, h4, a, button, label, li, td, th, code'),
    );
    const bad: TextViolation[] = [];

    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }

      const style = getComputedStyle(node);

      if (style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }

      if (node.scrollWidth <= node.clientWidth + 1) {
        continue;
      }

      const ellipsis =
        style.textOverflow === 'ellipsis' ||
        (style.overflowX === 'hidden' && (style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre'));
      const titled = Boolean(
        node.getAttribute('title') ||
          node.getAttribute('aria-label') ||
          node.closest('[title]') ||
          node.closest('[aria-label]'),
      );

      if (ellipsis && titled) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim().slice(0, 80);

      if (!text) {
        continue;
      }

      bad.push({
        text,
        tag: node.tagName.toLowerCase(),
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      });
    }

    return bad.slice(0, 12);
  });

  expect(violations, `${label}: truncated text without tooltip ${JSON.stringify(violations)}`).toEqual([]);
}

export async function assertSendInsideComposer(page: Page, label: string) {
  const card = page.getByTestId('composer-card');
  const send = page.getByTestId('composer-send');

  await expect(card, `${label}: composer card`).toBeVisible({ timeout: 20_000 });
  await expect(send, `${label}: send button`).toBeVisible({ timeout: 20_000 });

  const cardBox = await card.boundingBox();
  const sendBox = await send.boundingBox();

  expect(cardBox, `${label}: composer box`).toBeTruthy();
  expect(sendBox, `${label}: send box`).toBeTruthy();

  if (!cardBox || !sendBox) {
    return;
  }

  expect(sendBox.x, `${label}: send left`).toBeGreaterThanOrEqual(cardBox.x - 1);
  expect(sendBox.x + sendBox.width, `${label}: send right`).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
  expect(sendBox.y, `${label}: send top`).toBeGreaterThanOrEqual(cardBox.y - 1);
  expect(sendBox.y + sendBox.height, `${label}: send bottom`).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
}

export async function assertHomePrimaryActionsInView(page: Page, label: string) {
  const viewport = page.viewportSize();
  expect(viewport, `${label}: viewport`).toBeTruthy();

  if (!viewport) {
    return;
  }

  const heading = page.getByRole('heading', { name: /What do you want to/i });
  const composer = page.getByTestId('composer-card');
  const send = page.getByTestId('composer-send');
  const newBuild = page.getByRole('link', { name: 'New build' }).first();

  for (const [name, locator] of [
    ['heading', heading],
    ['composer', composer],
    ['send', send],
    ['new build', newBuild],
  ] as const) {
    await expect(locator, `${label}: ${name}`).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `${label}: ${name} box`).toBeTruthy();

    if (!box) {
      continue;
    }

    expect(box.y, `${label}: ${name} in view`).toBeGreaterThanOrEqual(-1);
    expect(box.y, `${label}: ${name} above fold`).toBeLessThan(viewport.height);
  }
}

export async function assertSurfaceLayout(page: Page, label: string, options?: { composer?: boolean }) {
  await assertNoHorizontalPageScroll(page, label);
  await assertContainedInCards(page, label);
  await assertTextEllipsisHasTooltip(page, label);

  if (options?.composer !== false && (await page.getByTestId('composer-card').count()) > 0) {
    await assertSendInsideComposer(page, label);
  }
}
