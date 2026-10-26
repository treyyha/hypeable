import { expect, test } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY } from './seed';

const CUSTOM_ENDPOINT_MESSAGE = 'Run Hypeable locally to use custom endpoints';

test.describe('hosted mode', () => {
  test('shows a run-locally hint and rejects custom endpoints', async ({ page, request }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);

    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Model and key' }).click();
    await expect(page.getByTestId('run-locally-hint').first()).toBeVisible({ timeout: 20_000 });

    const llmcall = await request.post('/api/llmcall', {
      data: {
        message: 'hello',
        model: 'mock-model',
        provider: { name: 'OpenAILike' },
      },
    });

    expect(llmcall.status()).toBe(403);
    expect(await llmcall.text()).toContain(CUSTOM_ENDPOINT_MESSAGE);

    const gitProxy = await request.get('/api/git-proxy/evil.example/repo.git/info/refs?service=git-upload-pack');
    expect(gitProxy.status()).toBe(403);
    expect(await gitProxy.text()).toContain(CUSTOM_ENDPOINT_MESSAGE);

    expect((await request.get('/api/mcp-check')).status()).toBe(404);
    expect((await request.post('/api/mcp-update-config', { data: { mcpServers: {} } })).status()).toBe(404);
    expect((await request.post('/api/bug-report', { data: {} })).status()).toBe(404);
    expect((await request.post('/api/update')).status()).toBe(404);
    expect((await request.get('/api/system/diagnostics')).status()).toBe(404);
    expect((await request.get('/api/system/git-info')).status()).toBe(404);
    expect((await request.get('/api/git-info')).status()).toBe(404);
    expect((await request.get('/api/check-env-key?provider=OpenAI')).status()).toBe(404);
    expect((await request.get('/api/configured-providers')).status()).toBe(404);
    expect((await request.get('/api/export-api-keys')).status()).toBe(410);

    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, hosted: true });
  });
});
