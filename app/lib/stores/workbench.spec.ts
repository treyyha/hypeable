import { atom, map } from 'nanostores';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import type { ArtifactState } from '~/lib/stores/workbench';

vi.mock('~/lib/persistence', () => ({ description: atom(undefined) }));
vi.mock('~/lib/webcontainer', () => ({ webcontainer: Promise.resolve({ workdir: '/home/project' }) }));
vi.mock('./files', () => ({
  FilesStore: class {
    files = map({});
    getFile() {
      return undefined;
    }
    createFile() {
      return Promise.resolve(true);
    }
    reset() {
      return Promise.resolve();
    }
  },
}));
vi.mock('./editor', () => ({
  EditorStore: class {
    documents = map({});
    currentDocument = atom(undefined);
    selectedFile = atom(undefined);
    updateFile = vi.fn();
    setSelectedFile = vi.fn();
  },
}));
vi.mock('./previews', () => ({
  PreviewsStore: class {
    previews = atom([]);
    reset = vi.fn();
  },
}));
vi.mock('./terminal', () => ({
  TerminalStore: class {
    boltTerminal = { executionState: atom(undefined), stop: vi.fn(async () => undefined) };
  },
}));

import { WorkbenchStore } from '~/lib/stores/workbench';

let store: WorkbenchStore;

function createArtifact(actionId: string, action: unknown) {
  const runner = {
    actions: map({ [actionId]: action }),
    runAction: vi.fn().mockResolvedValue(undefined),
    addAction: vi.fn().mockResolvedValue(undefined),
  };

  return { runner } as unknown as ArtifactState;
}

beforeEach(() => {
  store = new WorkbenchStore();
});

describe('WorkbenchStore._runAction', () => {
  it('should skip a file action that has no filePath instead of throwing', async () => {
    const artifactId = 'artifact-pathless';
    const actionId = 'action-pathless';

    store.artifacts.setKey(artifactId, createArtifact(actionId, { type: 'file', content: 'const a = 1;' }));

    const data = {
      artifactId,
      messageId: 'message-1',
      actionId,
      action: { type: 'file', content: 'const a = 1;' },
    } as unknown as ActionCallbackData;

    await expect(store._runAction(data)).resolves.toBeUndefined();

    const artifact = store.artifacts.get()[artifactId];
    expect(artifact.runner.runAction).not.toHaveBeenCalled();
  });

  it('should report a pathless file action only once across repeated streaming samples', async () => {
    const artifactId = 'artifact-sampled';
    const actionId = 'action-sampled';

    // The runner hands back the same action object on every streaming sample.
    const action = { type: 'file', content: 'const a = 1;' };
    store.artifacts.setKey(artifactId, createArtifact(actionId, action));

    const data = { artifactId, messageId: 'message-1', actionId, action } as unknown as ActionCallbackData;

    const warnings: string[] = [];

    const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });

    try {
      for (let i = 0; i < 25; i++) {
        await store._runAction(data, true);
      }
    } finally {
      log.mockRestore();
    }

    expect(warnings.filter((entry) => entry.includes('File action has no filePath'))).toHaveLength(1);
  });
});

describe('WorkbenchStore.addToExecutionQueue', () => {
  it('should keep processing later callbacks after one of them rejects', async () => {
    const executed: string[] = [];

    store.addToExecutionQueue(async () => {
      executed.push('first');
      throw new Error('boom');
    });

    store.addToExecutionQueue(async () => {
      executed.push('second');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(executed).toEqual(['first', 'second']);
  });
});

describe('WorkbenchStore.selectWorkbenchView', () => {
  it('should update currentView and record userSelectedView when userInitiated is true', () => {
    expect(store.currentView.get()).toBe('code');
    expect(store.userSelectedView.get()).toBeUndefined();

    store.selectWorkbenchView('diff', { userInitiated: true });
    expect(store.currentView.get()).toBe('diff');
    expect(store.userSelectedView.get()).toBe('diff');

    // Programmatic switch without userInitiated should change currentView but preserve userSelectedView
    store.selectWorkbenchView('preview');
    expect(store.currentView.get()).toBe('preview');
    expect(store.userSelectedView.get()).toBe('diff');
  });

  it('should reset userSelectedView when resetWorkbench() is called', async () => {
    store.selectWorkbenchView('diff', { userInitiated: true });
    expect(store.userSelectedView.get()).toBe('diff');

    store.showWorkbench.set(false);
    await store.resetWorkbench();
    expect(store.userSelectedView.get()).toBeUndefined();
    expect(store.currentView.get()).toBe('code');
    expect(store.showWorkbench.get()).toBe(true);
  });
});

describe('WorkbenchStore visibility', () => {
  it('opens the workbench by default', () => {
    expect(store.showWorkbench.get()).toBe(true);
  });
});

describe('WorkbenchStore.abortAllActions', () => {
  it('should call abortAllActions on all artifact runners and reset action alert', () => {
    const mockAbortAll = vi.fn();
    store.artifacts.setKey('artifact-1', {
      runner: { abortAllActions: mockAbortAll },
    } as unknown as ArtifactState);

    store.actionAlert.set({
      type: 'preview',
      title: 'Alert',
      description: 'Test alert',
      content: 'Test content',
    });

    store.abortAllActions();

    expect(mockAbortAll).toHaveBeenCalledTimes(1);
    expect(store.actionAlert.get()).toBeUndefined();
  });
});
