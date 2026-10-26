import type { MetaFunction } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { FirstRunOnboarding } from '~/components/onboarding/FirstRunOnboarding';
import { Menu } from '~/components/sidebar/Menu.client';
import { brandMeta } from '~/utils/brand';

export const meta: MetaFunction = () => brandMeta();

export const loader = () => Response.json({});

/**
 * App shell: collapsible sidebar + header + workbench. Home stays a clean prompt.
 */
export default function Index() {
  return (
    <div className="flex h-full w-full min-w-0 overflow-x-clip bg-hype-bg">
      <a
        href="#composer"
        className="absolute left-[-9999px] top-auto z-50 rounded-md bg-hype-surface-2 px-3 py-2 text-hype-text focus:left-3 focus:top-3"
      >
        Skip to composer
      </a>
      <ClientOnly>{() => <Menu />}</ClientOnly>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="relative min-h-0 flex-1">
          <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
        </div>
      </div>
      <FirstRunOnboarding />
    </div>
  );
}
