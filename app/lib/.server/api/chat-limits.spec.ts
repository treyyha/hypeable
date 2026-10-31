import { describe, expect, it } from 'vitest';
import { buildChatBody, chatBodyNear } from './chat-body-fixture';
import { REQUEST_LIMITS, chatRequestSchema } from './schemas';
import { action } from '~/routes/api.chat';

const MIB = 1024 * 1024;

function postChat(body: string) {
  return action({
    request: new Request('http://localhost:5173/api/chat', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' },
      body,
    }),
    context: { clientAddress: '127.0.0.1' },
    params: {},
  } as never) as Promise<Response>;
}

describe('/api/chat body limits', () => {
  it('caps the body at 2 MiB (see docs/LIMITS.md for the sizing)', () => {
    expect(REQUEST_LIMITS.MAX_CHAT_BODY_BYTES).toBe(2 * MIB);
    expect(REQUEST_LIMITS.MAX_ATTACHMENT_URL_CHARS).toBeLessThanOrEqual(REQUEST_LIMITS.MAX_CHAT_BODY_BYTES);
  });

  it('accepts a long realistic session just under the cap', () => {
    const body = chatBodyNear(REQUEST_LIMITS.MAX_CHAT_BODY_BYTES - 64 * 1024);
    expect(body.length).toBeGreaterThan(1.5 * MIB);
    expect(chatRequestSchema.safeParse(JSON.parse(body)).success).toBe(true);
  });

  it('returns a clean 413 JSON error just over the cap', async () => {
    const body = JSON.stringify({
      ...buildChatBody({ turns: 1 }),
      pad: 'x'.repeat(REQUEST_LIMITS.MAX_CHAT_BODY_BYTES),
    });

    const response = await postChat(body);

    expect(response.status).toBe(413);

    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ error: true, statusCode: 413, isRetryable: false });
    expect(text).not.toMatch(/at\s+\S+\s+\(|node_modules|\.ts:\d+/);
  });
});

describe('chatRequestSchema is strict', () => {
  it('accepts every top-level key the client and AI SDK send', () => {
    expect(chatRequestSchema.safeParse(buildChatBody({ turns: 1 })).success).toBe(true);
  });

  it.each(['userId', 'role', 'plan', 'price', 'system', 'model'])('rejects an unknown top-level %s', (key) => {
    const result = chatRequestSchema.safeParse({ ...buildChatBody({ turns: 1 }), [key]: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys in fixed-shape objects', () => {
    const body = buildChatBody({ turns: 1 });
    expect(chatRequestSchema.safeParse({ ...body, connectorEnabled: { github: true, admin: true } }).success).toBe(
      false,
    );
    expect(chatRequestSchema.safeParse({ ...body, supabase: { ...body.supabase, serviceRoleKey: 'x' } }).success).toBe(
      false,
    );
  });
});
