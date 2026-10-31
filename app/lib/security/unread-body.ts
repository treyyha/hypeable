/**
 * Early refusals (429, 403, 405) answer before the route reads the upload.
 * Under workerd an unread body then sometimes tears the connection down and
 * the client sees a 500 / ECONNRESET instead of the refusal. Cancelling it
 * tells the runtime the bytes are not wanted and stops the upload early.
 */
export function releaseUnreadBody(request: Request): Promise<void> | undefined {
  if (!request.body || request.bodyUsed) {
    return undefined;
  }

  return discardUnreadBody(request);
}

/**
 * Consume a small prefix then cancel the rest. workerd drops the connection
 * (client sees 500 / ECONNRESET) if we answer 429/403 and leave the upload
 * sitting unread on a keep-alive socket.
 */
export async function discardUnreadBody(request: Request): Promise<void> {
  if (!request.body || request.bodyUsed) {
    return;
  }

  try {
    const declared = Number(request.headers.get('content-length'));

    if (Number.isFinite(declared) && declared > 8 * 1024 * 1024) {
      await request.body.cancel();
      return;
    }

    await request.arrayBuffer();
  } catch {
    // Client already gone; the refusal still goes out.
  }
}
