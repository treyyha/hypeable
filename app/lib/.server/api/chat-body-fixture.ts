/**
 * Synthetic /api/chat bodies with the shape Chat.client.tsx sends (bodyRef plus
 * the AI SDK's id/trigger/messageId). Used to size the body cap and to time
 * parse + validate near it.
 */

const CODE_LINE = '  const value = items.filter((item) => item.enabled).map((item) => item.label);\n';

function codeOfSize(bytes: number): string {
  return CODE_LINE.repeat(Math.max(1, Math.ceil(bytes / CODE_LINE.length))).slice(0, bytes);
}

type FileEntry = { type: 'file'; content: string; isBinary: boolean } | { type: 'folder' };

export function buildChatBody(
  profile: { files?: number; fileBytes?: number; turns?: number; rewritesPerTurn?: number; imageBytes?: number } = {},
) {
  const { files = 60, fileBytes = 4096, turns = 25, rewritesPerTurn = 3, imageBytes = 0 } = profile;
  const fileMap: Record<string, FileEntry> = { '/home/project/src': { type: 'folder' } };

  for (let i = 0; i < files; i += 1) {
    fileMap[`/home/project/src/component-${i}.tsx`] = { type: 'file', content: codeOfSize(fileBytes), isBinary: false };
  }

  const messages: Array<Record<string, unknown>> = [];

  for (let turn = 0; turn < turns; turn += 1) {
    const userParts: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: `[Model: gpt-4o-mini]\n\n[Provider: OpenAI]\n\nTurn ${turn}: tweak the layout and fix the list.`,
      },
    ];

    if (turn === 0 && imageBytes > 0) {
      userParts.push({
        type: 'file',
        mediaType: 'image/png',
        url: `data:image/png;base64,${'A'.repeat(Math.ceil((imageBytes * 4) / 3))}`,
      });
    }

    messages.push({ id: `u-${turn}`, role: 'user', parts: userParts });

    const actions = Array.from(
      { length: rewritesPerTurn },
      (_, i) =>
        `<boltAction type="file" filePath="src/component-${(turn * rewritesPerTurn + i) % Math.max(files, 1)}.tsx">\n${codeOfSize(fileBytes)}</boltAction>`,
    ).join('\n');

    messages.push({
      id: `a-${turn}`,
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: `Updated the list.\n<boltArtifact id="turn-${turn}" title="Turn ${turn}">\n${actions}\n</boltArtifact>`,
        },
      ],
    });
  }

  messages.push({ id: 'u-last', role: 'user', parts: [{ type: 'text', text: 'One more change please.' }] });

  return {
    id: 'chat-fixture',
    messages,
    trigger: 'submit-message' as const,
    messageId: undefined,
    files: fileMap,
    promptId: 'default',
    contextOptimization: true,
    chatMode: 'build' as const,
    agentMode: false,
    designScheme: { palette: { primary: '#000000' }, features: ['rounded'], font: ['sans-serif'] },
    supabase: { isConnected: false, hasSelectedProject: false, credentials: {} },
    maxLLMSteps: 5,
    planMode: false,
    webSearchEnabled: true,
    connectorEnabled: {
      github: false,
      gitlab: false,
      vercel: false,
      netlify: false,
      supabase: false,
      browserUseCloud: false,
    },
    toolEnabled: {},
    plugins: [],
  };
}

export function chatBodyNear(targetBytes: number): string {
  const one = JSON.stringify(buildChatBody({ turns: 1 })).length;
  const perTurn = JSON.stringify(buildChatBody({ turns: 2 })).length - one;

  let turns = Math.max(1, Math.floor((targetBytes - one) / perTurn) + 1);
  let body = JSON.stringify(buildChatBody({ turns }));

  while (body.length > targetBytes && turns > 1) {
    turns -= 1;
    body = JSON.stringify(buildChatBody({ turns }));
  }

  return body;
}
