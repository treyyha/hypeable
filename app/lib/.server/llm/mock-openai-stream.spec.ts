import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HYPEABLE_KEY_HEADER } from '~/lib/api/request-keys';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

function installedVersions(name: string): string[] {
  const versions = new Set<string>();
  const hoisted = join(process.cwd(), 'node_modules', name, 'package.json');

  if (existsSync(hoisted)) {
    versions.add(JSON.parse(readFileSync(hoisted, 'utf8')).version as string);
  }

  const pnpmDir = join(process.cwd(), 'node_modules', '.pnpm');

  for (const dir of readdirSync(pnpmDir)) {
    if (dir !== name && !dir.startsWith(`${name}@`)) {
      continue;
    }

    const pkgPath = join(pnpmDir, dir, 'node_modules', name, 'package.json');

    if (existsSync(pkgPath)) {
      versions.add(JSON.parse(readFileSync(pkgPath, 'utf8')).version as string);
    }
  }

  if (versions.size === 0) {
    throw new Error(`could not find installed package ${name}`);
  }

  return [...versions];
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('mock server did not bind a port'));
        return;
      }

      resolve(address.port);
    });
    server.on('error', reject);
  });
}

function createMock(): Server {
  return createServer((req, res) => {
    const url = req.url || '/';

    if (req.method === 'GET' && url.includes('/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));

      return;
    }

    if (req.method === 'POST' && url.includes('/chat/completions')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.write(
        `data: ${JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'mock-model',
          choices: [{ index: 0, delta: { content: 'Hello from mock' }, finish_reason: null }],
        })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'mock-model',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      res.end();

      return;
    }

    res.writeHead(404);
    res.end();
  });
}

describe('OpenAI-like chat pipeline against a local mock', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createMock();

    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('is running on the overridden zod 4 / undici 7 / body-parser 2 / dompurify 3 packages', () => {
    expect(installedVersions('zod').some((version) => version.startsWith('4.'))).toBe(true);
    expect(installedVersions('undici').some((version) => version.startsWith('7.'))).toBe(true);
    expect(installedVersions('body-parser').some((version) => version.startsWith('2.'))).toBe(true);
    expect(installedVersions('dompurify').some((version) => version.startsWith('3.'))).toBe(true);
  });

  it('streams a reply through POST /api/llmcall with a fake key in x-hypeable-key', async () => {
    const { action } = await import('~/routes/api.llmcall');

    const providersCookie = encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl } }));

    const request = new Request('https://example.com/api/llmcall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [HYPEABLE_KEY_HEADER]: encodeURIComponent(JSON.stringify({ OpenAILike: FAKE_KEY })),
        Cookie: `providers=${providersCookie}`,
      },
      body: JSON.stringify({
        message: 'ping',
        model: 'mock-model',
        provider: { name: 'OpenAILike' },
        streamOutput: true,
      }),
    });

    const response = await action({
      request,
      context: { clientAddress: '10.0.0.9', cloudflare: { env: {} } },
      params: {},
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    const text = await response.text();
    expect(text).toContain('Hello from mock');
    expect(text).not.toContain(FAKE_KEY);
  });
});
