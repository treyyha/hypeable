import type { MetaFunction } from 'react-router';
import { ClientOnly } from 'remix-utils/client-only';
import { Header } from '~/components/header/Header';
import { FirstRunOnboarding } from '~/components/onboarding/FirstRunOnboarding';
import { Menu } from '~/components/sidebar/Menu.client';
import { SpendPage } from '~/components/spend/SpendPage';
import { LoadingState } from '~/components/ui/LoadingState';
import { brandMeta } from '~/utils/brand';

export const meta: MetaFunction = () => brandMeta('Spend · Hypeable', '/spend');

export const loader = () => Response.json({});

export default function SpendRoute() {
  return (
    <div className="flex h-full w-full bg-hype-bg">
      <ClientOnly>{() => <Menu />}</ClientOnly>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <ClientOnly fallback={<LoadingState />}>{() => <SpendPage />}</ClientOnly>
        </div>
      </div>
      <FirstRunOnboarding />
    </div>
  );
}
