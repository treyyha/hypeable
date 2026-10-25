/**
 * Fan-in for loop signals from action-runner / preview without importing the
 * store (keeps unit tests and SSR from touching localStorage).
 */

export type LoopErrorSource = 'preview' | 'terminal' | 'shell' | 'action' | 'write';

export type LoopSignalListener = {
  error?: (raw: string, source: LoopErrorSource) => void;
  write?: (filePath: string, content: string) => void;
  success?: () => void;
};

let listener: LoopSignalListener = {};

export function setLoopSignalListener(next: LoopSignalListener): () => void {
  listener = next;

  return () => {
    if (listener === next) {
      listener = {};
    }
  };
}

export function emitLoopError(raw: string, source: LoopErrorSource): void {
  listener.error?.(raw, source);
}

export function emitLoopWrite(filePath: string, content: string): void {
  listener.write?.(filePath, content);
}

export function emitLoopSuccess(): void {
  listener.success?.();
}
