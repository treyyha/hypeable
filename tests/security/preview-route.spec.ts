/**
 * The preview popup route turns its id into `https://<id>.local-credentialless.webcontainer-api.io`
 * and frames it. A decoded `/`, `?`, `#` or `@` in the id used to let anyone
 * frame an arbitrary site under a hypeable.dev URL.
 */
import { describe, expect, it } from 'vitest';
import { loader } from '~/routes/webcontainer.preview.$id';

async function status(id: string): Promise<number> {
  try {
    const response = await loader({ params: { id }, request: new Request('https://hypeable.dev/'), context: {} } as never);
    return response.status;
  } catch (thrown) {
    if (thrown instanceof Response) {
      return thrown.status;
    }

    throw thrown;
  }
}

describe('webcontainer preview id', () => {
  it('accepts a WebContainer preview label', async () => {
    expect(await status('k03e2io1a8b7c6--5173--c8c182a3')).toBe(200);
  });

  it.each(['evil.example/phish?', 'evil.example#', 'a.b', 'x@evil.example', 'x\\evil', 'x:443', ' x', 'a'.repeat(64)])(
    'refuses %j',
    async (id) => {
      expect(await status(id)).toBe(404);
    },
  );
});
