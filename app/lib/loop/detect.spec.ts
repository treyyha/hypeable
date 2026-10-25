import { describe, expect, it, vi } from 'vitest';
import { emptyLoopState, fireAbortOnce, publicLoopState, reduceLoop } from './detect';
import { DEFAULT_LOOP_SETTINGS } from './settings';

const ERR_A = `TypeError: Cannot read properties of undefined (reading 'map')
    at App (/Users/alice/proj/src/App.tsx:12:4)`;
const ERR_A_OTHER = `TypeError: Cannot read properties of undefined (reading 'map')
    at App (C:\\Users\\bob\\proj\\src\\App.tsx:90:1)`;

const ERR_B = 'Error: listen EADDRINUSE :::5173';

function feedErrors(count: number, raw = ERR_A, sessionTotal = 0) {
  let state = emptyLoopState('chat-1');
  state = reduceLoop(state, { type: 'user', text: 'build a todo app', messageId: 'user-1' });

  for (let i = 0; i < count; i += 1) {
    state = reduceLoop(state, {
      type: 'error',
      raw,
      source: 'preview',
      sessionTotal: sessionTotal + i * 0.1,
    });
  }

  return state;
}

describe('loop detector', () => {
  it('triggers after N identical errors since the last real user message', () => {
    const state = feedErrors(3);
    const view = publicLoopState(state);
    expect(view.isLooping).toBe(true);
    expect(view.count).toBe(3);
    expect(view.revertToMessageId).toBe('user-1');
    expect(state.shouldAbort).toBe(true);
  });

  it('treats the same error on different paths as one signature', () => {
    let state = emptyLoopState('chat-1');
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0 });
    state = reduceLoop(state, { type: 'error', raw: ERR_A_OTHER, sessionTotal: 0 });
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0 });
    expect(state.errorCount).toBe(3);
    expect(state.isLooping).toBe(true);
  });

  it('resets the counter on a different error', () => {
    let state = feedErrors(2);
    state = reduceLoop(state, { type: 'error', raw: ERR_B, sessionTotal: 0.3 });
    expect(state.errorCount).toBe(1);
    expect(state.isLooping).toBe(false);
    expect(state.shouldAbort).toBe(false);
  });

  it('resets on a clean build and on a user message that is not an auto-fix', () => {
    let state = feedErrors(2);
    state = reduceLoop(state, { type: 'success' });
    expect(state.errorCount).toBe(0);

    state = feedErrors(2);
    state = reduceLoop(state, { type: 'user', text: 'try a sidebar instead', messageId: 'user-2' });
    expect(state.errorCount).toBe(0);
    expect(state.lastSafeMessageId).toBe('user-2');
  });

  it('does not reset on an auto-fix request', () => {
    let state = feedErrors(2);
    state = reduceLoop(state, {
      type: 'user',
      text: '*Fix this preview error* \n```js\nboom\n```\n',
      messageId: 'fix-1',
    });
    expect(state.errorCount).toBe(2);
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0.3 });
    expect(state.isLooping).toBe(true);
    expect(state.errorCount).toBe(3);
  });

  it('triggers when the same file is rewritten with identical content N times', () => {
    let state = emptyLoopState('chat-1');

    const write = { type: 'write' as const, filePath: 'src/App.tsx', content: 'export const x = 1;\n' };

    state = reduceLoop(state, { ...write, sessionTotal: 0 });
    state = reduceLoop(state, { ...write, sessionTotal: 0.05 });
    expect(state.isLooping).toBe(false);
    state = reduceLoop(state, { ...write, sessionTotal: 0.1 });
    expect(state.isLooping).toBe(true);
    expect(state.loopKind).toBe('write');
    expect(state.writeCount).toBe(3);
  });

  it('resets the write streak when the content changes', () => {
    let state = emptyLoopState('chat-1');
    state = reduceLoop(state, {
      type: 'write',
      filePath: 'src/App.tsx',
      content: 'a',
      sessionTotal: 0,
    });
    state = reduceLoop(state, {
      type: 'write',
      filePath: 'src/App.tsx',
      content: 'a',
      sessionTotal: 0,
    });
    state = reduceLoop(state, {
      type: 'write',
      filePath: 'src/App.tsx',
      content: 'b',
      sessionTotal: 0,
    });
    expect(state.writeCount).toBe(1);
    expect(state.isLooping).toBe(false);
  });

  it('honours the threshold setting (2–5)', () => {
    let state = emptyLoopState('chat-1', { enabled: true, threshold: 2 });
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0 });
    expect(state.isLooping).toBe(false);
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0 });
    expect(state.isLooping).toBe(true);
    expect(state.settings.threshold).toBe(2);

    state = reduceLoop(state, { type: 'settings', settings: { threshold: 9 } });
    expect(state.settings.threshold).toBe(5);
  });

  it('does not trigger when disabled', () => {
    let state = emptyLoopState('chat-1', { enabled: false, threshold: 2 });
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0 });
    state = reduceLoop(state, { type: 'error', raw: ERR_A, sessionTotal: 0 });
    expect(state.isLooping).toBe(false);
  });

  it('sums wasted cost from the first occurrence', () => {
    const state = feedErrors(3, ERR_A, 1.2);
    expect(state.wastedCost).toBeCloseTo(0.2, 6);
  });

  it('calls abort once on the transition into looping', () => {
    const abort = vi.fn();

    let prev = emptyLoopState('chat-1');
    let next = prev;

    for (let i = 0; i < 3; i += 1) {
      next = reduceLoop(prev, { type: 'error', raw: ERR_A, sessionTotal: i * 0.05 });
      fireAbortOnce(prev, next, abort);
      prev = next;
    }

    expect(abort).toHaveBeenCalledTimes(1);
    fireAbortOnce(prev, next, abort);
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('Keep going dismisses and resets the counter', () => {
    let state = feedErrors(3);
    state = reduceLoop(state, { type: 'dismiss' });
    expect(state.isLooping).toBe(false);
    expect(state.errorCount).toBe(0);
  });

  it('starts a fresh buffer when the chat id changes', () => {
    let state = feedErrors(2);
    state = reduceLoop(state, { type: 'chat', chatId: 'chat-2' });
    expect(state.chatId).toBe('chat-2');
    expect(state.errorCount).toBe(0);
    expect(state.settings).toEqual(DEFAULT_LOOP_SETTINGS);
  });
});
