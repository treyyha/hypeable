import { describe, expect, it, vi } from 'vitest';
import { emitLoopError, emitLoopSuccess, emitLoopWrite, setLoopSignalListener } from './signals';

describe('loop signals', () => {
  it('forwards error, write, and success to the registered listener', () => {
    const error = vi.fn();
    const write = vi.fn();
    const success = vi.fn();
    const stop = setLoopSignalListener({ error, write, success });

    emitLoopError('boom', 'preview');
    emitLoopWrite('src/App.tsx', 'x');
    emitLoopSuccess();

    expect(error).toHaveBeenCalledWith('boom', 'preview');
    expect(write).toHaveBeenCalledWith('src/App.tsx', 'x');
    expect(success).toHaveBeenCalledTimes(1);

    stop();
    emitLoopError('later', 'terminal');
    expect(error).toHaveBeenCalledTimes(1);
  });
});
