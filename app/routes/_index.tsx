import type { MetaFunction } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { FirstRunOnboarding } from '~/components/onboarding/FirstRunOnboarding';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { brandMeta } from '~/utils/brand';

export const meta: MetaFunction = () => brandMeta();

export const loader = () => Response.json({});

/**
 * Landing page. Settings stay in the sidebar so this screen stays a clean prompt.
 */
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      <FirstRunOnboarding />
    </div>
  );
}
