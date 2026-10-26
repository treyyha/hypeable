import { afterEach, describe, expect, it } from 'vitest';
import { hostedNotFoundIfEnabled, isHostedFromContext, isHostedMode } from './hosted';

const original = process.env.HYPEABLE_HOSTED;

afterEach(() => {
  if (original === undefined) {
    delete process.env.HYPEABLE_HOSTED;
  } else {
    process.env.HYPEABLE_HOSTED = original;
  }
});

describe('hosted mode flag', () => {
  it('is off when the env var is unset', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(isHostedMode()).toBe(false);
    expect(isHostedFromContext({})).toBe(false);
    expect(hostedNotFoundIfEnabled({})).toBeUndefined();
  });

  it('turns on for 1 on process.env or Cloudflare env', () => {
    process.env.HYPEABLE_HOSTED = '1';
    expect(isHostedMode()).toBe(true);

    delete process.env.HYPEABLE_HOSTED;
    expect(isHostedFromContext({ cloudflare: { env: { HYPEABLE_HOSTED: '1' } } })).toBe(true);
  });

  it('returns 404 only when hosted', async () => {
    const blocked = hostedNotFoundIfEnabled({ cloudflare: { env: { HYPEABLE_HOSTED: '1' } } });
    expect(blocked).toBeInstanceOf(Response);
    expect(blocked?.status).toBe(404);
    expect(await blocked?.text()).toBe('');
  });
});
