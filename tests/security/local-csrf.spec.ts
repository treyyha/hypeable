/**
 * Local-only routes are 404 in hosted mode, so their attacker is a website the
 * user visits while Hypeable runs on localhost. `fetch(url, { method: 'POST',
 * body: '{...}' })` with the default text/plain type and an HTML form both skip
 * CORS preflight, so these routes must check Origin themselves.
 */
import { describe, expect, it } from 'vitest';
import { action as bugReport } from '~/routes/api.bug-report';
import { action as mcpUpdateConfig } from '~/routes/api.mcp-update-config';

const LOCAL_CONTEXT = { hostname: 'localhost', clientAddress: '127.0.0.1', cloudflare: { env: {} } };

async function statusOf(run: () => Promise<Response>): Promise<number> {
  try {
    return (await run()).status;
  } catch (thrown) {
    if (thrown instanceof Response) {
      return thrown.status;
    }

    throw thrown;
  }
}

function crossSite(body: BodyInit, contentType?: string): Request {
  return new Request('http://localhost:5173/api/x', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', ...(contentType ? { 'Content-Type': contentType } : {}) },
    body,
  });
}

describe('local-only routes refuse cross-site POSTs', () => {
  it('mcp-update-config will not take a server config from another site', async () => {
    const plant = JSON.stringify({ mcpServers: { x: { type: 'sse', url: 'https://evil.example/sse' } } });

    expect(
      await statusOf(() => mcpUpdateConfig({ request: crossSite(plant), context: LOCAL_CONTEXT, params: {} } as never)),
    ).toBe(403);

    const noOrigin = new Request('http://localhost:5173/api/mcp-update-config', { method: 'POST', body: plant });
    expect(await statusOf(() => mcpUpdateConfig({ request: noOrigin, context: LOCAL_CONTEXT, params: {} } as never))).toBe(
      403,
    );
  });

  it('mcp-update-config still serves the same-origin app', async () => {
    const request = new Request('http://localhost:5173/api/mcp-update-config', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpServers: {} }),
    });

    expect(await statusOf(() => mcpUpdateConfig({ request, context: LOCAL_CONTEXT, params: {} } as never))).toBe(200);
  });

  it('bug-report will not file an issue from a cross-site form', async () => {
    const form = new FormData();
    form.set('title', 'spam');
    form.set('description', 'spam spam spam');

    expect(await statusOf(() => bugReport({ request: crossSite(form), context: LOCAL_CONTEXT, params: {} } as never))).toBe(
      403,
    );
  });
});
