// Blocks field tampering: only the fields we list are accepted, everything else is rejected.
// Identity (userId, role, plan, price) is NEVER read from the client. Take it from the session.
import { z } from 'zod';

export const ChatRequest = z
  .object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(100_000) })).max(200),
    model: z.string().max(100),
    provider: z.enum(['anthropic', 'openai', 'openrouter']),
    // NOTE: no userId, role, price, or plan fields on purpose. .strict() rejects them.
  })
  .strict();

export async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > 1_000_000) throw new Response('Payload too large', { status: 413 });
  let json: unknown;
  try { json = await request.json(); } catch { throw new Response('Bad JSON', { status: 400 }); }
  const result = schema.safeParse(json);
  if (!result.success) throw new Response('Invalid input', { status: 400 });
  return result.data;
}

// CSRF/origin check for state-changing requests.
export function assertSameOrigin(request: Request, allowed: string[]) {
  const origin = request.headers.get('origin');
  if (!origin || !allowed.includes(origin)) throw new Response('Forbidden', { status: 403 });
}
