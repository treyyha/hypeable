import { useStore } from '@nanostores/react';
import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { description as descriptionStore } from '~/lib/persistence/chat-meta';
import { chatStore } from '~/lib/stores/chat';
import { sidebarMobileOpenStore, toggleSidebarMobile } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';

const HeaderActionButtons = lazy(() =>
  import('./HeaderActionButtons.client').then((module) => ({ default: module.HeaderActionButtons })),
);

const CostMeter = lazy(() => import('~/components/cost/CostMeter').then((module) => ({ default: module.CostMeter })));
const PlanPanel = lazy(() => import('~/components/plan/PlanPanel').then((module) => ({ default: module.PlanPanel })));

const PredeployHost = lazy(() =>
  import('~/components/predeploy/PredeployHost').then((module) => ({ default: module.PredeployHost })),
);
const ChatDescription = lazy(() =>
  import('~/lib/persistence/ChatDescription.client').then((module) => ({ default: module.ChatDescription })),
);

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
  const location = useLocation();

  const crumb =
    location.pathname === '/spend'
      ? 'spend'
      : location.pathname === '/privacy'
        ? 'privacy'
        : location.pathname === '/terms'
          ? 'terms'
          : null;

  return (
    <header
      className={classNames(
        'flex items-center gap-3 border-b border-hype-border bg-hype-bg px-3 h-[var(--header-height)]',
      )}
    >
      <button
        type="button"
        className="hype-icon-btn lg:hidden"
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
          {crumb ? (
            crumb
          ) : chat.started ? (
            <ClientOnly fallback="new build">
              {() => (
                <Suspense fallback="new build">
                  <HeaderChatTitle />
                </Suspense>
              )}
            </ClientOnly>
          ) : (
            'new build'
          )}
        </span>
      </nav>

      <ClientOnly>
        {() => (
          <Suspense fallback={null}>
            <PlanPanel />
          </Suspense>
        )}
      </ClientOnly>
      <ClientOnly>
        {() => (
          <Suspense fallback={null}>
            <PredeployHost />
          </Suspense>
        )}
      </ClientOnly>

      <div className="ml-auto flex items-center gap-1.5">
        <ClientOnly>
          {() => (
            <Suspense fallback={null}>
              <CostMeter />
            </Suspense>
          )}
        </ClientOnly>
        <ClientOnly>{() => <ThemeSwitch />}</ClientOnly>
        <button
          type="button"
          onClick={openSettings}
          className="hype-icon-btn"
          aria-label="Keys and settings"
          title="Keys and settings"
        >
          <span className="i-ph:key text-lg" />
        </button>
        {chat.started && (
          <ClientOnly>
            {() => (
              <Suspense fallback={null}>
                <div>
                  <HeaderActionButtons chatStarted={chat.started} />
                </div>
              </Suspense>
            )}
          </ClientOnly>
        )}
      </div>
    </header>
  );
}
