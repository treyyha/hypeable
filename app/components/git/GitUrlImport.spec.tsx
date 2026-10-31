import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostedMode } from '~/lib/stores/hosted';

const { gitClone, importChat, searchUrl } = vi.hoisted(() => ({
  gitClone: vi.fn(),
  importChat: vi.fn(),
  searchUrl: { value: 'https://github.com/owner/repo' as string | null },
}));

vi.mock('react-router', () => ({
  useSearchParams: () => [new URLSearchParams(searchUrl.value ? { url: searchUrl.value } : {})],
}));
vi.mock('remix-utils/client-only', () => ({
  ClientOnly: ({ children }: { children: () => React.ReactNode }) => <>{children()}</>,
}));
vi.mock('~/components/chat/Chat.client', () => ({ Chat: () => null }));
vi.mock('~/components/chat/BaseChat', () => ({ BaseChat: () => null }));
vi.mock('~/lib/hooks/useGit', () => ({ useGit: () => ({ ready: true, gitClone }) }));
vi.mock('~/lib/persistence', () => ({ useChatHistory: () => ({ ready: true, importChat }) }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

const { GitUrlImport } = await import('./GitUrlImport.client');

function messageText(message: UIMessage): string {
  return message.parts.map((part) => ('text' in part ? part.text : '')).join('');
}

function importedText(): string {
  const messages = importChat.mock.calls[0][1] as UIMessage[];
  return messages.map(messageText).join('\n');
}

describe('GitUrlImport deep link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHostedMode(false);
    searchUrl.value = 'https://github.com/owner/repo';
    gitClone.mockResolvedValue({
      workdir: '/home/project',
      data: {
        'package.json': {
          data: JSON.stringify({ scripts: { dev: 'vite', postinstall: 'node evil.js' } }),
          encoding: 'utf8',
        },
        'index.js': { data: 'console.log(1)', encoding: 'utf8' },
      },
    });
    importChat.mockResolvedValue(undefined);
  });

  it('does not clone until the user confirms the full URL and host', async () => {
    render(<GitUrlImport />);

    expect(await screen.findByTestId('git-import-url')).toHaveTextContent('https://github.com/owner/repo');
    expect(screen.getByTestId('git-import-host')).toHaveTextContent('github.com');
    expect(gitClone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    await waitFor(() => expect(gitClone).toHaveBeenCalledWith('https://github.com/owner/repo'));
  });

  it('does not queue npm install or any repo script without a second confirmation', async () => {
    render(<GitUrlImport />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clone' }));

    const commands = await screen.findAllByTestId('git-import-command');
    expect(commands.map((node) => node.textContent).join(' ')).toContain('install');
    expect(screen.getByText(/Warning:/)).toBeInTheDocument();
    expect(importChat).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Import files only' }));
    await waitFor(() => expect(importChat).toHaveBeenCalledTimes(1));
    expect(importedText()).not.toMatch(/boltAction type="(shell|start)"/);
  });

  it('queues the setup commands only after the second yes', async () => {
    render(<GitUrlImport />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Run commands' }));

    await waitFor(() => expect(importChat).toHaveBeenCalledTimes(1));
    expect(importedText()).toMatch(/boltAction type="shell">[^<]*install/);
  });

  it('refuses a non-GitHub/GitLab host in hosted mode without cloning', async () => {
    setHostedMode(true);
    searchUrl.value = 'https://evil.example/owner/repo';
    render(<GitUrlImport />);

    expect(await screen.findByText(/only clone from GitHub or GitLab/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clone' })).toBeNull();
    expect(gitClone).not.toHaveBeenCalled();
  });
});
