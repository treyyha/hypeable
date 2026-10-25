import { type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { HYPEABLE_KEY_HEADER } from '~/lib/api/request-keys';
import { buildApprovedPlanMessage, defaultTickedFeatureIds, parsePlanReply } from '~/lib/plan';

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

describe('plan mode against the mock OpenAI server', () => {
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

  it('goes plan -> approve (ticked features only) -> build', async () => {
    const { action } = await import('~/routes/api.chat');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    const providersCookie = encodeURIComponent(JSON.stringify({ OpenAILike: { enabled: true, baseUrl } }));
    const keyHeader = encodeURIComponent(JSON.stringify({ OpenAILike: FAKE_KEY }));

    const planResponse = await action({
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HYPEABLE_KEY_HEADER]: keyHeader,
          Cookie: `providers=${providersCookie}`,
        },
        body: JSON.stringify({
          chatMode: 'build',
          planMode: true,
          messages: [
            {
              id: 'user-plan',
              role: 'user',
              parts: [{ type: 'text', text: '[Model: mock-model]\n\n[Provider: OpenAILike]\n\nBuild a notes app' }],
            },
          ],
        }),
      }),
      context: { clientAddress: '10.0.0.12', cloudflare: { env: {} } },
      params: {},
    } as never);

    const planText = await planResponse.text();
    expect(planResponse.status).toBe(200);
    expect(planText).toContain('hypeable-plan');
    expect(planText).toContain('Notes app');

    const parsed = parsePlanReply(extractFromStream(planText) || planText);
    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const ticked = defaultTickedFeatureIds(parsed.plan);
    const approved = buildApprovedPlanMessage(parsed.plan, ticked);
    expect(approved).toContain('PLAN.md');
    expect(approved).toContain('List notes');
    expect(approved).not.toContain('Tag a note');

    const buildResponse = await action({
      request: new Request('https://example.com/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HYPEABLE_KEY_HEADER]: keyHeader,
          Cookie: `providers=${providersCookie}`,
        },
        body: JSON.stringify({
          chatMode: 'build',
          planMode: false,
          messages: [
            {
              id: 'user-build',
              role: 'user',
              parts: [{ type: 'text', text: `[Model: mock-model]\n\n[Provider: OpenAILike]\n\n${approved}` }],
            },
          ],
        }),
      }),
      context: { clientAddress: '10.0.0.12', cloudflare: { env: {} } },
      params: {},
    } as never);

    const buildText = await buildResponse.text();
    expect(buildResponse.status).toBe(200);
    expect(buildText).toMatch(/boltArtifact|Todo app/);
    expect(buildText).not.toContain('```hypeable-plan');
    expect(buildText).not.toContain(FAKE_KEY);

    errorSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  }, 20_000);
});

function extractFromStream(text: string): string {
  const unescaped = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
  const fence = unescaped.match(/```hypeable-plan[\s\S]*?```/i);

  if (fence) {
    const introMatch = unescaped.match(/Here is a short plan\./);

    return `${introMatch ? 'Here is a short plan.\n\n' : ''}${fence[0]}`;
  }

  return unescaped;
}
