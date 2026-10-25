#!/usr/bin/env node
/**
 * Tiny OpenAI-compatible streaming server for local pipeline proofs.
 *
 *   node scripts/dev/mock-openai.mjs
 *
 * Listens on 127.0.0.1:8787. Accepts any Bearer token. Does not log headers.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_OPENAI_PORT || 8787);
const HOST = process.env.MOCK_OPENAI_HOST || '127.0.0.1';

function sendChatChunks(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });

  const chunks = ['Hello', ' from', ' mock'];

  for (const content of chunks) {
    res.write(
      `data: ${JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'mock-model',
        choices: [{ index: 0, delta: { content }, finish_reason: null }],
      })}\n\n`,
    );
  }

  res.write(
    `data: ${JSON.stringify({
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'mock-model',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`,
  );
  res.write('data: [DONE]\n\n');
  res.end();
}

export function createMockOpenAIServer() {
  return http.createServer((req, res) => {
    const url = req.url || '/';

    if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
      return;
    }

    if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat/completions')) {
      sendChatChunks(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'not found', type: 'invalid_request_error' } }));
  });
}

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}` || process.argv[1]?.endsWith('mock-openai.mjs')) {
  const server = createMockOpenAIServer();
  server.listen(PORT, HOST, () => {
    console.log(`mock openai listening on http://${HOST}:${PORT}`);
  });
}
