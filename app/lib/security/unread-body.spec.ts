import { describe, expect, it } from 'vitest';
import { discardUnreadBody, releaseUnreadBody } from './unread-body';

function upload() {
  let cancelled = false;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() {
      cancelled = true;
    },
  });

  return {
    request: new Request('http://localhost/api/chat', { method: 'POST', body, duplex: 'half' } as RequestInit),
    wasCancelled: () => cancelled,
  };
}

describe('releaseUnreadBody', () => {
  it('drains a modest upload the route never read', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2048));
        controller.close();
      },
      cancel() {
        /* unused */
      },
    });
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);

    await discardUnreadBody(request);
    expect(request.bodyUsed).toBe(true);
  });

  it('leaves a body alone once a route started reading it', async () => {
    const { request, wasCancelled } = upload();
    const reader = request.body!.getReader();
    await reader.read();

    await discardUnreadBody(request);
    expect(wasCancelled()).toBe(false);
    await reader.cancel();
  });

  it('ignores requests without a body', () => {
    expect(releaseUnreadBody(new Request('http://localhost/api/health'))).toBeUndefined();
  });

  it('cancels a huge declared upload instead of buffering it', async () => {
    let cancelled = false;

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-length': String(9 * 1024 * 1024) },
      body,
      duplex: 'half',
    } as RequestInit);

    await discardUnreadBody(request);
    expect(cancelled).toBe(true);
  });
});
