import { beforeEach, describe, expect, it, vi } from 'vitest';

const { showWorkbench, selectWorkbenchView } = vi.hoisted(() => ({
  showWorkbench: { set: vi.fn(), get: vi.fn(() => false) },
  selectWorkbenchView: vi.fn(),
}));

vi.mock('./workbench', () => ({
  workbenchStore: {
    showWorkbench,
    selectWorkbenchView,
    currentView: { get: () => 'code' },
  },
}));

import { chatStore } from './chat';
import { setMobilePane } from './mobile-pane';

describe('setMobilePane', () => {
  beforeEach(() => {
    chatStore.set({ started: true, aborted: false, showChat: true, mobilePane: 'chat' });
    showWorkbench.set.mockClear();
    selectWorkbenchView.mockClear();
  });

  it('shows only chat when Chat is selected', () => {
    setMobilePane('preview');
    setMobilePane('chat');
    expect(chatStore.get().showChat).toBe(true);
    expect(showWorkbench.set).toHaveBeenCalledWith(false);
    expect(chatStore.get().mobilePane).toBe('chat');
  });

  it('opens the workbench on Preview and Code', () => {
    setMobilePane('preview');
    expect(chatStore.get().showChat).toBe(false);
    expect(showWorkbench.set).toHaveBeenCalledWith(true);
    expect(selectWorkbenchView).toHaveBeenCalledWith('preview', { userInitiated: true });

    setMobilePane('code');
    expect(selectWorkbenchView).toHaveBeenCalledWith('code', { userInitiated: true });
  });
});
