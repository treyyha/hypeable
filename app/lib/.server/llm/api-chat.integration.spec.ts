import { type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HYPEABLE_KEY_HEADER } from '~/lib/api/request-keys';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

vi.mock('~/lib/services/mcpService', () => {
  class MCPService {
    static getInstance() {
      return new MCPService();
    }

    processToolInvocations(messages: unknown) {
      return Promise.resolve(messages);
    }

    processToolCall() {
      return undefined;
    }

    getToolsWithoutExecute() {
      return {};
    }
  }

  return { MCPService };
});

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

describe('POST /api/chat against a local OpenAI-compatible mock', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { createMockOpenAIServer } = (await import('../../../../scripts/dev/mock-openai.mjs')) as {
      createMockOpenAIServer: () => Server;
    };

    server = createMockOpenAIServer();

    const port = await listen(server);
    baseUrl = `http://127.0.0.1:${port}/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('streams text and a usage annotation, and never echoes the key', async () => {
    const { action } = await import('~/routes/api.chat');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const providersCookie = encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl } }));

    const request = new Request('https://example.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [HYPEABLE_KEY_HEADER]: encodeURIComponent(JSON.stringify({ OpenAILike: FAKE_KEY })),
        Cookie: `providers=${providersCookie}`,
      },
      body: JSON.stringify({
        chatMode: 'discuss',
        messages: [
          {
            id: 'user-1',
            role: 'user',
            parts: [{ type: 'text', text: '[Model: mock-model]\n\n[Provider: OpenAILike]\n\nping' }],
          },
        ],
      }),
    });

    const response = await action({
      request,
      context: { clientAddress: '10.0.0.11', cloudflare: { env: {} } },
      params: {},
    } as never);

    const text = await response.text();

    const printed = [...errorSpy.mock.calls, ...logSpy.mock.calls, ...infoSpy.mock.calls, ...debugSpy.mock.calls]
      .flat()
      .map(String)
      .join(' ');

    errorSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(text).toMatch(/Hello from mock|Hello/);
    expect(text).toMatch(/promptTokens/);
    expect(text).toMatch(/completionTokens/);
    expect(text).not.toContain(FAKE_KEY);
    expect(printed).not.toContain(FAKE_KEY);
  });
});
