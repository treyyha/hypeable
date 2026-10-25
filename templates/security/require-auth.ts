// Call this at the top of EVERY server loader/action that needs a user. The UI is not a security boundary.
import { readSession } from './session';

export async function requireAuth(request: Request) {
  const session = await readSession(request);
  if (!session) throw new Response('Unauthorized', { status: 401 });
  return session; // use session.userId, never a userId from the request body
}

// Ownership check: also verify the resource belongs to the caller.
export function assertOwner(resourceOwnerId: string, userId: string) {
  if (resourceOwnerId !== userId) throw new Response('Forbidden', { status: 403 });
}
