import { useStore } from '@nanostores/react';
import { lazy, Suspense } from 'react';
import { useLocation, type MetaFunction } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Header } from '~/components/header/Header';
import { SidebarShell } from '~/components/sidebar/SidebarShell';
import { homeChatShouldLoad, homeMenuShouldLoad, requestMenuLoad } from '~/lib/performance/prefetch-home';
import { chatStore } from '~/lib/stores/chat';
import { brandMeta } from '~/utils/brand';

const Chat = lazy(() => import('~/components/chat/Chat.client').then((module) => ({ default: module.Chat })));
const Menu = lazy(() => import('~/components/sidebar/Menu.client').then((module) => ({ default: module.Menu })));

export const meta: MetaFunction = () => brandMeta();

export const loader = () => Response.json({});

/**
 * App shell: collapsible sidebar + header + workbench. Home stays a clean prompt.
 * The SSR hero and first-run card stay mounted until a build starts so LCP is
 * not a client-only dialog. Menu stays behind intent so the provider registry
 * is not on the first view.
 */
export default function Index() {
  const { pathname, search } = useLocation();
  const restoredChat = pathname.startsWith('/chat/');
  const started = useStore(chatStore).started;
  const shouldLoad = useStore(homeChatShouldLoad);
  const menuShouldLoad = useStore(homeMenuShouldLoad);
  const params = new URLSearchParams(search);
  const debugLoad = params.get('debugStarted') === '1' || params.get('debugLoop') === '1';
  const loadChat = shouldLoad || started || restoredChat || debugLoad;
  const showHomeShell = !started && !restoredChat;

  return (
    <div className="flex h-full w-full min-w-0 overflow-x-clip bg-hype-bg">
      <a
        href="#composer"
        className="absolute left-[-9999px] top-auto z-50 rounded-md bg-hype-surface-2 px-3 py-2 text-hype-text focus:left-3 focus:top-3"
      >
        Skip to composer
      </a>
      {menuShouldLoad ? (
        <Suspense fallback={<SidebarShell />}>
          <Menu />
        </Suspense>
      ) : (
        <SidebarShell onIntent={requestMenuLoad} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="relative min-h-0 flex-1">
          {showHomeShell ? <BaseChat /> : null}
          {loadChat ? (
            <ClientOnly fallback={restoredChat ? <BaseChat /> : null}>
              {() => (
                <Suspense fallback={restoredChat ? <BaseChat /> : null}>
                  <Chat suppressHome={showHomeShell} />
                </Suspense>
              )}
            </ClientOnly>
          ) : null}
        </div>
      </div>
    </div>
  );
}
