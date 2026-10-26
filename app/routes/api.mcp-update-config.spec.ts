import { describe, expect, it } from 'vitest';
import { action } from './api.mcp-update-config';

function post(body: unknown) {
  return action({
    request: new Request('https://example.com/api/mcp-update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    params: {},
    context: {},
  } as never);
}

describe('POST /api/mcp-update-config', () => {
  it('returns 404 in hosted mode', async () => {
    const response = await action({
      request: new Request('https://example.com/api/mcp-update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcpServers: {} }),
      }),
      params: {},
      context: { cloudflare: { env: { HYPEABLE_HOSTED: '1' } } },
    } as never);

    expect(response.status).toBe(404);
  });

  it('accepts the empty onboarding default without loading MCP clients', async () => {
    const response = await post({ mcpServers: {} });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({});
  });

  it('rejects invalid JSON and extra fields', async () => {
    const badJson = await post('{');
    expect(badJson.status).toBe(400);

    const extra = await post({ mcpServers: {}, extra: true });
    expect(extra.status).toBe(400);
  });
});
