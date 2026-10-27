import { lazy, Suspense, useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Header } from '~/components/header/Header';
import { scheduleHomePrefetch } from '~/lib/performance/prefetch-home';
import { brandMeta } from '~/utils/brand';

const Chat = lazy(() => import('~/components/chat/Chat.client').then((module) => ({ default: module.Chat })));
const Menu = lazy(() => import('~/components/sidebar/Menu.client').then((module) => ({ default: module.Menu })));

const FirstRunOnboarding = lazy(() =>
  import('~/components/onboarding/FirstRunOnboarding').then((module) => ({ default: module.FirstRunOnboarding })),
);

export const meta: MetaFunction = () => brandMeta();

export const loader = () => Response.json({});

/**
 * App shell: collapsible sidebar + header + workbench. Home stays a clean prompt.
 */
export default function Index() {
  useEffect(() => scheduleHomePrefetch(), []);

  return (
    <div className="flex h-full w-full min-w-0 overflow-x-clip bg-hype-bg">
      <a
        href="#composer"
        className="absolute left-[-9999px] top-auto z-50 rounded-md bg-hype-surface-2 px-3 py-2 text-hype-text focus:left-3 focus:top-3"
      >
        Skip to composer
      </a>
      <ClientOnly
        fallback={<div className="hidden shrink-0 lg:block lg:w-[var(--hype-sidebar-width)]" aria-hidden="true" />}
      >
        {() => (
          <Suspense
            fallback={<div className="hidden shrink-0 lg:block lg:w-[var(--hype-sidebar-width)]" aria-hidden="true" />}
          >
            <Menu />
          </Suspense>
        )}
      </ClientOnly>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="relative min-h-0 flex-1">
          <ClientOnly fallback={<BaseChat />}>
            {() => (
              <Suspense fallback={<BaseChat />}>
                <Chat />
              </Suspense>
            )}
          </ClientOnly>
        </div>
      </div>
      <ClientOnly>
        {() => (
          <Suspense fallback={null}>
            <FirstRunOnboarding />
          </Suspense>
        )}
      </ClientOnly>
    </div>
  );
}
