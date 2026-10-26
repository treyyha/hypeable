/**
 * Chat | Preview | Code switch for viewports below the lg split.
 */

import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { setMobilePane, type MobilePane } from '~/lib/stores/mobile-pane';
import { classNames } from '~/utils/classNames';

const TABS: Array<{ id: MobilePane; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
];

export function MobilePaneTabs() {
  const { mobilePane } = useStore(chatStore);

  return (
    <div
      role="tablist"
      aria-label="Chat, preview, and code"
      data-testid="mobile-pane-tabs"
      className="fixed inset-x-0 bottom-0 z-workbench flex shrink-0 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 lg:hidden"
    >
      {TABS.map((tab) => {
        const selected = mobilePane === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`mobile-pane-${tab.id}`}
            className={classNames(
              'flex-1 appearance-none border-0 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring',
              selected
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'bg-transparent text-bolt-elements-textSecondary',
            )}
            onClick={() => setMobilePane(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
