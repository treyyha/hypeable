import { afterEach, describe, expect, it } from 'vitest';
import {
  hostedNotFoundIfEnabled,
  hostFromContext,
  hostnameFromRequest,
  hostnameFromRequestUrl,
  isHostedFromContext,
  isHostedMode,
  isPrivateOrLoopbackHost,
} from './hosted';

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

  it('does not treat a missing or empty Host as private (fail closed)', () => {
    expect(isPrivateOrLoopbackHost(undefined)).toBe(false);
    expect(isPrivateOrLoopbackHost(null)).toBe(false);
    expect(isPrivateOrLoopbackHost('')).toBe(false);
    expect(isPrivateOrLoopbackHost('   ')).toBe(false);
  });
});

describe('hostnameFromRequestUrl', () => {
  it('reads only the request URL host and ignores forwarded-host spoofing', () => {
    const publicUrl = new Request('https://hypeable.dev/api/health', {
      headers: {
        Host: 'localhost',
        'X-Forwarded-Host': 'localhost',
        Forwarded: 'host=localhost;proto=https',
        'X-Original-Host': 'localhost',
        'X-Host': '127.0.0.1',
      },
    });

    expect(hostnameFromRequest(publicUrl)).toBe('hypeable.dev');
    expect(hostnameFromRequestUrl(publicUrl.url)).toBe('hypeable.dev');
    expect(isHostedMode(undefined, hostnameFromRequest(publicUrl))).toBe(true);

    const localUrl = new Request('http://localhost:5173/', {
      headers: {
        'X-Forwarded-Host': 'evil.example',
        Host: 'hypeable.dev',
        Forwarded: 'host=evil.example',
      },
    });

    expect(hostnameFromRequest(localUrl)).toBe('localhost');
    expect(isHostedMode(undefined, hostnameFromRequest(localUrl))).toBe(false);
  });

  it('returns empty string for a missing or unparseable URL', () => {
    expect(hostnameFromRequestUrl(undefined)).toBe('');
    expect(hostnameFromRequestUrl('')).toBe('');
    expect(hostnameFromRequestUrl('not a url')).toBe('');
    expect(hostnameFromRequestUrl('/relative')).toBe('');
  });
});

describe('hosted mode flag', () => {
  it('fail-closes when the request Host is missing, empty, or unparseable', () => {
    delete process.env.HYPEABLE_HOSTED;
    delete process.env.HYPEABLE_SELF_HOSTED;
    expect(isHostedMode(undefined, '')).toBe(true);
    expect(isHostedMode(undefined, '   ')).toBe(true);
    expect(isHostedMode(undefined, null)).toBe(true);
    expect(isHostedMode(undefined, hostnameFromRequestUrl('not a url'))).toBe(true);
    expect(isHostedFromContext({})).toBe(true);
    expect(isHostedFromContext({ hostname: '' })).toBe(true);
    expect(hostFromContext({})).toBe('');
    expect(hostedNotFoundIfEnabled({})?.status).toBe(404);
  });

  it('fail-closes on a weird Host that is not loopback', () => {
    delete process.env.HYPEABLE_HOSTED;
    expect(isHostedMode(undefined, '!!!')).toBe(true);
    expect(isHostedMode(undefined, '..')).toBe(true);
    expect(isHostedMode(undefined, 'not a hostname')).toBe(true);
    expect(isHostedMode(undefined, '*')).toBe(true);
    expect(isHostedFromContext({ hostname: 'totally invalid host!!' })).toBe(true);
  });

  it('env-only callers (no request Host argument) stay open without the env flag', () => {
    delete process.env.HYPEABLE_HOSTED;
    delete process.env.HYPEABLE_SELF_HOSTED;
    expect(isHostedMode()).toBe(false);
    expect(isHostedMode({})).toBe(false);
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
    expect(isHostedFromContext({ hostname: 'localhost' })).toBe(false);
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
