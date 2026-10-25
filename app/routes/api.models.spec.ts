import { type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HYPEABLE_PROVIDERS_HEADER } from '~/lib/api/provider-settings';
import { HYPEABLE_KEY_HEADER } from '~/lib/api/request-keys';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

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

describe('GET /api/models/OpenAILike', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { createMockOpenAIServer } = (await import('../../scripts/dev/mock-openai.mjs')) as {
      createMockOpenAIServer: () => Server;
    };

    server = createMockOpenAIServer();

    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}/v1`;
  }, 15_000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('lists mock-model when the key header and base URL travel together, without a cookie', async () => {
    const { loader } = await import('./api.models');

    const request = new Request('https://example.com/api/models/OpenAILike', {
      headers: {
        [HYPEABLE_KEY_HEADER]: encodeURIComponent(JSON.stringify({ OpenAILike: FAKE_KEY })),
        [HYPEABLE_PROVIDERS_HEADER]: encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl } })),
      },
    });

    const response = await loader({
      request,
      params: { provider: 'OpenAILike' },
      context: { cloudflare: { env: {} } },
    });

    const body = (await response.json()) as { modelList: Array<{ name: string; provider: string }> };

    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.modelList.some((model) => model.name === 'mock-model' && model.provider === 'OpenAILike')).toBe(true);
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);
  }, 15_000);

  it('returns no OpenAILike models when the base URL is missing', async () => {
    const { loader } = await import('./api.models');

    const request = new Request('https://example.com/api/models/OpenAILike', {
      headers: {
        [HYPEABLE_KEY_HEADER]: encodeURIComponent(JSON.stringify({ OpenAILike: FAKE_KEY })),
      },
    });

    const response = await loader({
      request,
      params: { provider: 'OpenAILike' },
      context: { cloudflare: { env: {} } },
    });

    const body = (await response.json()) as { modelList: Array<{ provider: string }> };

    expect(body.modelList.filter((model) => model.provider === 'OpenAILike')).toEqual([]);
  }, 15_000);
});
