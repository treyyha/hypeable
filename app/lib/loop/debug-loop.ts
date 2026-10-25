/**
 * Dev-only helper so `?debugLoop=1` can show the loop panel without a real
 * failure. The production client bundle must not include this module: the hook
 * loads it behind `import.meta.env.DEV` so Vite drops the import.
 */
import { recordUsage } from '~/lib/stores/cost';
import { reportLoopError } from '~/lib/stores/loop';

let fired = false;

export function runDebugLoopOnce(): void {
  if (fired || typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get('debugLoop') !== '1') {
    return;
  }

  fired = true;

  const err = `TypeError: Cannot read properties of undefined (reading 'map')
    at App (/Users/demo/proj/src/App.tsx:12:4)`;
  reportLoopError(err, 'preview');
  recordUsage({
    id: 'debug-loop-cost',
    model: 'claude-3-haiku-20240307',
    promptTokens: 400_000,
    completionTokens: 80_000,
  });
  reportLoopError(
    `TypeError: Cannot read properties of undefined (reading 'map')
    at App (C:\\Users\\demo\\proj\\src\\App.tsx:44:8)`,
    'preview',
  );
  reportLoopError(err, 'preview');
}
