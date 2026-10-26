import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { CostMeter } from '~/components/cost/CostMeter';
import { PlanPanel } from '~/components/plan/PlanPanel';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { description as descriptionStore } from '~/lib/persistence';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { chatStore } from '~/lib/stores/chat';
import { sidebarMobileOpenStore, toggleSidebarMobile } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';

function openSettings() {
  document.dispatchEvent(new CustomEvent('open-hypeable-settings', { detail: { tab: 'settings' } }));
}

function HeaderChatTitle() {
  const title = useStore(descriptionStore);

  if (!title) {
    return 'new build';
  }

  return <ChatDescription />;
}

export function Header() {
  const chat = useStore(chatStore);
  const mobileOpen = useStore(sidebarMobileOpenStore);

  return (
    <header
      className={classNames(
        'flex items-center gap-3 border-b border-hype-border bg-hype-bg px-3 h-[var(--header-height)]',
      )}
    >
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--hype-radius-sm)] text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
        aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
        onClick={toggleSidebarMobile}
      >
        <span className={mobileOpen ? 'i-ph:x text-xl' : 'i-ph:list text-xl'} />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <a href="/" className="shrink-0 lowercase tracking-tight text-hype-muted">
          hypeable
        </a>
        <span className="text-hype-muted" aria-hidden="true">
          /
        </span>
        <span className="min-w-0 truncate text-hype-text">
          {chat.started ? <ClientOnly fallback="new build">{() => <HeaderChatTitle />}</ClientOnly> : 'new build'}
        </span>
      </nav>

      <ClientOnly>{() => <PlanPanel />}</ClientOnly>

      <div className="ml-auto flex items-center gap-1.5">
        <ClientOnly>{() => <CostMeter />}</ClientOnly>
        <ClientOnly>{() => <ThemeSwitch />}</ClientOnly>
        <button
          type="button"
          onClick={openSettings}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--hype-radius-sm)] text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
          aria-label="Keys and settings"
          title="Keys and settings"
        >
          <span className="i-ph:key text-lg" />
        </button>
        {chat.started && (
          <ClientOnly>
            {() => (
              <div>
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        )}
      </div>
    </header>
  );
}
