import { afterEach, describe, expect, it } from 'vitest';
import { hostedNotFoundIfEnabled, isHostedFromContext, isHostedMode, isPrivateOrLoopbackHost } from './hosted';

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

describe('isPrivateOrLoopbackHost', () => {
  it('treats loopback, localhost, and RFC1918 as private', () => {
    expect(isPrivateOrLoopbackHost('localhost')).toBe(true);
    expect(isPrivateOrLoopbackHost('localhost:5173')).toBe(true);
    expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('10.0.0.4')).toBe(true);
    expect(isPrivateOrLoopbackHost('192.168.1.9')).toBe(true);
    expect(isPrivateOrLoopbackHost('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('169.254.1.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('[::1]')).toBe(true);
    expect(isPrivateOrLoopbackHost('::1')).toBe(true);
    expect(isPrivateOrLoopbackHost('app.local')).toBe(true);
  });

  it('treats public DNS names as not private', () => {
    expect(isPrivateOrLoopbackHost('hypeable.dev')).toBe(false);
    expect(isPrivateOrLoopbackHost('hypeable.pages.dev')).toBe(false);
    expect(isPrivateOrLoopbackHost('example.com:443')).toBe(false);
    expect(isPrivateOrLoopbackHost('172.32.0.1')).toBe(false);
  });
});

describe('hosted mode flag', () => {
  it('is off when env is unset and there is no host (tests / Electron)', () => {
    delete process.env.HYPEABLE_HOSTED;
    delete process.env.HYPEABLE_SELF_HOSTED;
    expect(isHostedMode()).toBe(false);
    expect(isHostedFromContext({})).toBe(false);
    expect(hostedNotFoundIfEnabled({})).toBeUndefined();
  });

  it('turns on for HYPEABLE_HOSTED=1 even on localhost', () => {
    delete process.env.HYPEABLE_HOSTED;
    process.env.HYPEABLE_HOSTED = '1';
    expect(isHostedMode()).toBe(true);
    expect(isHostedMode(undefined, 'localhost')).toBe(true);
    expect(isHostedFromContext({ cloudflare: { env: { HYPEABLE_HOSTED: '1' } } })).toBe(true);
  });

  it('turns on for a public Host without the env var (fail closed)', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(isHostedMode(undefined, 'hypeable.dev')).toBe(true);
    expect(isHostedFromContext({ hostname: 'hypeable.pages.dev' })).toBe(true);

    const blocked = hostedNotFoundIfEnabled({ hostname: 'example.com' });
    expect(blocked).toBeInstanceOf(Response);
    expect(blocked?.status).toBe(404);
  });

  it('stays off for loopback and private-LAN hosts without the env var', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(isHostedMode(undefined, 'localhost')).toBe(false);
    expect(isHostedMode(undefined, '127.0.0.1:5173')).toBe(false);
    expect(isHostedMode(undefined, '192.168.0.10')).toBe(false);
    expect(isHostedFromContext({ hostname: '10.1.2.3' })).toBe(false);
  });

  it('HYPEABLE_SELF_HOSTED=1 wins over env and public Host', () => {
    process.env.HYPEABLE_HOSTED = '1';
    process.env.HYPEABLE_SELF_HOSTED = '1';
    expect(isHostedMode(undefined, 'hypeable.dev')).toBe(false);
    expect(
      isHostedFromContext({
        hostname: 'hypeable.dev',
        cloudflare: { env: { HYPEABLE_HOSTED: '1', HYPEABLE_SELF_HOSTED: '1' } },
      }),
    ).toBe(false);
  });
});
