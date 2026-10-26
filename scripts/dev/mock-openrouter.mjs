#!/usr/bin/env node
/**
 * Tiny OpenRouter OAuth stand-in for local connect-flow proofs.
 *
 *   node scripts/dev/mock-openrouter.mjs
 *
 * Listens on 127.0.0.1:8788. Does not log the code, verifier, or key.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_OPENROUTER_PORT || 8788);
const HOST = process.env.MOCK_OPENROUTER_HOST || '127.0.0.1';
const OK_CODE = 'mock-or-code';
const FAIL_CODE = 'mock-or-fail';
const MOCK_KEY = 'sk-or-e2e-mock';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store',
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function createMockOpenRouterServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();

      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      sendJson(res, 200, { ok: true });

      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth') {
      const callback = url.searchParams.get('callback_url');
      const state = url.searchParams.get('state') || '';
      const fail = url.searchParams.get('fail') === '1';

      if (!callback) {
        sendJson(res, 400, { error: { message: 'callback_url required' } });

        return;
      }

      const dest = new URL(callback);
      dest.searchParams.set('code', fail ? FAIL_CODE : OK_CODE);

      if (state) {
        dest.searchParams.set('state', state);
      }

      res.writeHead(302, { Location: dest.toString(), 'Cache-Control': 'no-store' });
      res.end();

      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/keys') {
      void readBody(req).then((raw) => {
        let parsed = {};

        try {
          parsed = JSON.parse(raw || '{}');
        } catch {
          parsed = {};
        }

        const code = typeof parsed.code === 'string' ? parsed.code : '';
        const verifier = typeof parsed.code_verifier === 'string' ? parsed.code_verifier : '';

        if (code === FAIL_CODE) {
          sendJson(res, 403, { error: { message: 'Invalid code' } });

          return;
        }

        if (code !== OK_CODE || !verifier) {
          sendJson(res, 403, { error: { message: 'Invalid code or code_verifier' } });

          return;
        }

        sendJson(res, 200, { key: MOCK_KEY, user_id: 'user_e2e' });
      });

      return;
    }

    sendJson(res, 404, { error: { message: 'not found' } });
  });
}

if (
  import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}` ||
  process.argv[1]?.endsWith('mock-openrouter.mjs')
) {
  const server = createMockOpenRouterServer();
  server.listen(PORT, HOST, () => {
    console.log(`mock openrouter listening on http://${HOST}:${PORT}`);
  });
}
