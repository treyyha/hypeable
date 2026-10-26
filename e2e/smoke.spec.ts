import { expect, test, type Page, type Response } from '@playwright/test';
import { E2E_FAKE_KEY, MOCK_OPENAI_BASE_URL, seedOpenAILikeMock } from './seed';

const PREVIEW = process.env.E2E_PREVIEW === '1';

function collectLeaks(page: Page) {
  const consoleHits: string[] = [];
  const bodyHits: string[] = [];
  const chatCacheControl: string[] = [];

  page.on('console', (message) => {
    if (message.text().includes(E2E_FAKE_KEY)) {
      consoleHits.push(message.type());
    }
  });

  page.on('response', (response) => {
    void inspectResponse(response, bodyHits, chatCacheControl);
  });

  return { consoleHits, bodyHits, chatCacheControl };
}

async function inspectResponse(response: Response, bodyHits: string[], chatCacheControl: string[]) {
  const url = response.url();
  const path = new URL(url).pathname;
  const contentType = response.headers()['content-type'] ?? '';

  if (path === '/api/chat' || path.startsWith('/api/chat/')) {
    chatCacheControl.push(response.headers()['cache-control'] ?? '');
  }

  // Do not consume SSE bodies; Playwright reading them can stall the page stream.
  if (contentType.includes('text/event-stream')) {
    return;
  }

  try {
    const text = await response.text();

    if (text.includes(E2E_FAKE_KEY)) {
      bodyHits.push(path);
    }
  } catch {
    // Binary / already-consumed bodies are not searchable; skip.
  }
}

async function workerdOpenAILikeModels(page: Page): Promise<string[]> {
  return page.evaluate(async ({ providersHeader }) => {
    const keys = JSON.parse(localStorage.getItem('hypeable_api_keys') || '{}') as Record<string, string>;
    const response = await fetch('/api/models/OpenAILike', {
      headers: {
        'x-hypeable-key': encodeURIComponent(JSON.stringify(keys)),
        'x-hypeable-providers': providersHeader,
      },
    });
    const data = (await response.json()) as { modelList?: Array<{ name: string; provider: string }> };

    return (data.modelList ?? []).filter((model) => model.provider === 'OpenAILike').map((model) => model.name);
  }, { providersHeader: encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl: MOCK_OPENAI_BASE_URL } })) });
}

test.describe('OpenAILike mock smoke', () => {
  test('plan, approve, cost, loop panel, and no key leak', async ({ page }) => {
    test.setTimeout(120_000);

    const leaks = collectLeaks(page);
    await seedOpenAILikeMock(page);

    const documentResponse = await page.goto('/');
    expect(documentResponse).toBeTruthy();
    expect(documentResponse?.headers()['cross-origin-embedder-policy']).toBe('credentialless');
    expect(documentResponse?.headers()['cross-origin-opener-policy']).toBe('same-origin');

    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await expect(page.locator('header').getByText('new build')).toBeVisible();

    await page.getByRole('button', { name: 'Model and key' }).click();

    const providerBox = page.getByRole('combobox').first();
    await expect(providerBox).toContainText('OpenAILike', { timeout: 20_000 });

    const listed = await workerdOpenAILikeModels(page);
    expect(listed, `workerd OpenAILike models: ${listed.join(',') || '(none)'}`).toContain('mock-model');
    await expect(page.getByRole('combobox').nth(1)).toContainText(/mock-model/i, { timeout: 20_000 });

    const textarea = page.locator('textarea').first();
    await textarea.fill('make a todo app');
    await textarea.press('Enter');

    const plan = page.getByRole('region', { name: 'Build plan' });
    await expect(plan).toBeVisible({ timeout: 45_000 });
    await expect(plan.getByRole('heading', { name: 'Notes app' })).toBeVisible();

    const optional = plan.getByRole('checkbox', { name: /Tag a note/i });
    // Optional features start unchecked; tick then untick so Approve sees it off.
    if (await optional.isChecked()) {
      await optional.uncheck();
    } else {
      await optional.check();
      await optional.uncheck();
    }

    await expect(optional).not.toBeChecked();

    await plan.getByRole('button', { name: 'Approve & build' }).click();

    await expect(page.getByText("I'll create a small todo app.")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.artifact').getByText('Todo app')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Click to open Workbench')).toBeVisible();

    const costPill = page.getByRole('button', { name: /Session spend/i });
    await expect(costPill).toBeVisible();
    await expect(costPill).not.toHaveText(/\$0\.000/);
    await expect(costPill).not.toHaveText(/price unknown/i);

    if (PREVIEW) {
      test.info().annotations.push({
        type: 'note',
        description: 'debugLoop is stripped from production builds; skipped in e2e:preview',
      });
    } else {
      await page.goto('/?debugLoop=1');
      await expect(page.getByRole('status')).toContainText('Same error, looping', { timeout: 15_000 });
    }

    expect(leaks.consoleHits, 'console must not print the fake key').toEqual([]);
    expect(leaks.bodyHits, 'network bodies must not echo the fake key').toEqual([]);
    expect(await page.content()).not.toContain(E2E_FAKE_KEY);
    expect(leaks.chatCacheControl.length).toBeGreaterThan(0);
    expect(leaks.chatCacheControl.every((value) => value.includes('no-store'))).toBe(true);
  });
});
