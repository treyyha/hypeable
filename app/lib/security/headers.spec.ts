import { describe, expect, it } from 'vitest';
import {
  API_SECURITY_HEADERS,
  DOCUMENT_ONLY_HEADER_NAMES,
  REFERRER_POLICY,
  applyApiSecurityHeaders,
  isApiRequest,
} from './headers';

describe('isApiRequest', () => {
  it('matches /api and /api/* only', () => {
    expect(isApiRequest(new Request('https://hypeable.dev/api/health'))).toBe(true);
    expect(isApiRequest(new Request('https://hypeable.dev/api'))).toBe(true);
    expect(isApiRequest(new Request('https://hypeable.dev/api/chat'))).toBe(true);
    expect(isApiRequest(new Request('https://hypeable.dev/'))).toBe(false);
    expect(isApiRequest(new Request('https://hypeable.dev/apifoo'))).toBe(false);
    expect(isApiRequest(new Request('https://hypeable.dev/spend'))).toBe(false);
  });
});

describe('applyApiSecurityHeaders', () => {
  it('fills nosniff, Referrer-Policy, and Cache-Control: no-store', () => {
    const wrapped = applyApiSecurityHeaders(new Response('{"ok":true}', { status: 200 }));

    expect(wrapped.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(wrapped.headers.get('Referrer-Policy')).toBe(REFERRER_POLICY);
    expect(wrapped.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not add document-only headers', () => {
    const wrapped = applyApiSecurityHeaders(new Response('{}'));

    for (const name of DOCUMENT_ONLY_HEADER_NAMES) {
      expect(wrapped.headers.get(name)).toBeNull();
    }
  });

  it('keeps an existing no-store Cache-Control (including extra directives)', () => {
    const wrapped = applyApiSecurityHeaders(new Response('{}', { headers: { 'Cache-Control': 'no-store, private' } }));

    expect(wrapped.headers.get('Cache-Control')).toBe('no-store, private');
  });

  it('replaces a weaker Cache-Control with no-store', () => {
    const wrapped = applyApiSecurityHeaders(new Response('{}', { headers: { 'Cache-Control': 'public, max-age=60' } }));

    expect(wrapped.headers.get('Cache-Control')).toBe(API_SECURITY_HEADERS['Cache-Control']);
  });

  it('keeps a stricter Referrer-Policy', () => {
    const wrapped = applyApiSecurityHeaders(new Response('{}', { headers: { 'Referrer-Policy': 'no-referrer' } }));

    expect(wrapped.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('replaces a weaker Referrer-Policy', () => {
    const wrapped = applyApiSecurityHeaders(new Response('{}', { headers: { 'Referrer-Policy': 'unsafe-url' } }));

    expect(wrapped.headers.get('Referrer-Policy')).toBe(REFERRER_POLICY);
  });

  it('passes a streamed body through without buffering and still sets API headers', async () => {
    let release!: () => void;

    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode('first'));
        await gate;
        controller.enqueue(encoder.encode('second'));
        controller.close();
      },
    });

    const wrapped = applyApiSecurityHeaders(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );

    expect(wrapped.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(wrapped.headers.get('Referrer-Policy')).toBe(REFERRER_POLICY);
    expect(wrapped.headers.get('Cache-Control')).toBe('no-store');
    expect(wrapped.headers.get('Content-Type')).toBe('text/event-stream');
    expect(wrapped.headers.get('Cross-Origin-Opener-Policy')).toBeNull();

    const reader = wrapped.body?.getReader();
    expect(reader).toBeTruthy();

    const decoder = new TextDecoder();
    const first = await reader!.read();

    expect(first.done).toBe(false);
    expect(decoder.decode(first.value)).toBe('first');

    release();

    const second = await reader!.read();

    expect(second.done).toBe(false);
    expect(decoder.decode(second.value)).toBe('second');
  });
});
