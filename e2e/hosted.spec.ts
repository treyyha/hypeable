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
      headers: { Origin: 'http://localhost:5173' },
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
    expect(gitProxy.headers()['x-content-type-options']).toBe('nosniff');
    expect(gitProxy.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(gitProxy.headers()['cache-control']).toContain('no-store');
    expect(gitProxy.headers()['access-control-allow-origin']).toBeFalsy();

    const gitUserinfo = await request.get('/api/git-proxy/evil.com@github.com/owner/repo.git/info/refs');
    expect(gitUserinfo.status()).toBe(403);

    const gitOptions = await request.fetch('/api/git-proxy/github.com/owner/repo.git/info/refs?service=git-upload-pack', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(gitOptions.status()).toBe(204);
    expect(gitOptions.headers()['access-control-allow-origin']).toBeFalsy();

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
    expect(health.headers()['x-content-type-options']).toBe('nosniff');
    expect(health.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(health.headers()['cache-control']).toContain('no-store');
    expect(health.headers()['cross-origin-opener-policy']).toBeFalsy();
    expect(health.headers()['cross-origin-embedder-policy']).toBeFalsy();
    expect(health.headers()['content-security-policy-report-only']).toBeFalsy();
    expect(health.headers()['permissions-policy']).toBeFalsy();
    expect(health.headers()['access-control-allow-origin']).toBeFalsy();

    const healthJson = (await health.json()) as { ok: boolean; hosted: boolean; commit: string };
    expect(healthJson).toMatchObject({ ok: true, hosted: true });
    expect(healthJson.commit.length).toBeGreaterThan(0);

    expect((await request.get('/robots.txt')).status()).toBe(200);
    expect((await request.get('/sitemap.xml')).status()).toBe(200);
    expect((await request.get('/llms.txt')).status()).toBe(200);
    expect((await request.get('/site.webmanifest')).status()).toBe(200);
    expect((await request.get('/webcontainer/connect/x')).status()).toBe(404);
    expect((await request.get('/favicon.svg')).status()).toBe(200);
    expect((await request.get('/og.png')).status()).toBe(200);
    expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
  });

  test('connector and deploy APIs require the user token and stay on allowed hosts', async ({ request }) => {
    const origin = 'http://localhost:5173';
    const jsonHeaders = { Origin: origin, 'Content-Type': 'application/json' };

    const vercelNoToken = await request.post('/api/vercel-deploy', {
      headers: jsonHeaders,
      data: { files: { 'index.html': '<p>ok</p>' }, chatId: 'hosted-e2e' },
    });
    expect(vercelNoToken.status()).toBe(401);

    const netlifyNoToken = await request.post('/api/netlify-deploy', {
      headers: jsonHeaders,
      data: { files: { 'index.html': '<p>ok</p>' }, chatId: 'hosted-e2e' },
    });
    expect(netlifyNoToken.status()).toBe(401);

    const githubNoToken = await request.get('/api/github-user', { headers: { Origin: origin } });
    expect(githubNoToken.status()).toBe(401);

    const supabaseNoToken = await request.post('/api/supabase', {
      headers: jsonHeaders,
      data: {},
    });
    expect(supabaseNoToken.status()).toBe(401);

    const gitlabSelfHosted = await request.post('/api/gitlab-projects', {
      headers: jsonHeaders,
      data: { token: 'not-a-real-token', gitlabUrl: 'https://gitlab.example.com' },
    });
    expect(gitlabSelfHosted.status()).toBe(403);
    expect(await gitlabSelfHosted.text()).toContain(CUSTOM_ENDPOINT_MESSAGE);

    const vercelCrossOrigin = await request.post('/api/vercel-deploy', {
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      data: { files: { 'index.html': '<p>ok</p>' }, chatId: 'hosted-e2e', token: 'fake-user-token' },
    });
    expect(vercelCrossOrigin.status()).toBe(403);
  });

  test('OpenRouter callback route is served hosted', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'true');
    }, ONBOARDING_COMPLETED_KEY);

    const response = await page.goto('/auth/openrouter/callback');
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('alert').or(page.getByRole('status'))).toBeVisible({ timeout: 20_000 });
    expect(page.url()).not.toContain('code=');
  });
});
