import { afterEach, describe, expect, it } from 'vitest';
import { loader } from './api.health';

type HealthBody = { ok: boolean; hosted: boolean; commit: string };

async function healthJson(response: Response): Promise<HealthBody> {
  return (await response.json()) as HealthBody;
}

const originalHosted = process.env.HYPEABLE_HOSTED;
const originalSelf = process.env.HYPEABLE_SELF_HOSTED;

afterEach(() => {
  if (originalHosted === undefined) {
    delete process.env.HYPEABLE_HOSTED;
  } else {
    process.env.HYPEABLE_HOSTED = originalHosted;
  }

  if (originalSelf === undefined) {
    delete process.env.HYPEABLE_SELF_HOSTED;
  } else {
    process.env.HYPEABLE_SELF_HOSTED = originalSelf;
  }
});

describe('GET /api/health', () => {
  it('reports hosted:true when the request Host is missing', async () => {
    delete process.env.HYPEABLE_HOSTED;
    delete process.env.HYPEABLE_SELF_HOSTED;

    const response = await loader({
      request: new Request('http://localhost:5173/api/health'),
      params: {},
      context: {},
    } as never);

    const body = await healthJson(response);

    expect(body).toMatchObject({ ok: true, hosted: true });
    expect(typeof body.commit).toBe('string');
    expect(body.commit.length).toBeGreaterThan(0);
  });

  it('reports hosted:false on loopback without env', async () => {
    delete process.env.HYPEABLE_HOSTED;
    delete process.env.HYPEABLE_SELF_HOSTED;

    const response = await loader({
      request: new Request('http://localhost:5173/api/health'),
      params: {},
      context: { hostname: 'localhost' },
    } as never);

    const body = await healthJson(response);

    expect(body).toMatchObject({ ok: true, hosted: false });
    expect(typeof body.commit).toBe('string');
  });

  it('reports hosted:true on a public Host even without env', async () => {
    delete process.env.HYPEABLE_HOSTED;
    delete process.env.HYPEABLE_SELF_HOSTED;

    const response = await loader({
      request: new Request('https://hypeable.dev/api/health'),
      params: {},
      context: { hostname: 'hypeable.dev' },
    } as never);

    const body = await healthJson(response);

    expect(body).toMatchObject({ ok: true, hosted: true });
  });

  it('reports hosted:true when HYPEABLE_HOSTED=1 on localhost', async () => {
    process.env.HYPEABLE_HOSTED = '1';
    delete process.env.HYPEABLE_SELF_HOSTED;

    const response = await loader({
      request: new Request('http://localhost:5173/api/health'),
      params: {},
      context: { hostname: 'localhost', cloudflare: { env: { HYPEABLE_HOSTED: '1' } } },
    } as never);

    const body = await healthJson(response);

    expect(body).toMatchObject({ ok: true, hosted: true });
  });

  it('reports hosted:false when HYPEABLE_SELF_HOSTED=1 on a public Host', async () => {
    process.env.HYPEABLE_HOSTED = '1';
    process.env.HYPEABLE_SELF_HOSTED = '1';

    const response = await loader({
      request: new Request('https://hypeable.dev/api/health'),
      params: {},
      context: {
        hostname: 'hypeable.dev',
        cloudflare: { env: { HYPEABLE_HOSTED: '1', HYPEABLE_SELF_HOSTED: '1' } },
      },
    } as never);

    const body = await healthJson(response);

    expect(body).toMatchObject({ ok: true, hosted: false });
  });
});
