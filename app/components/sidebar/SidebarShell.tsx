/**
 * SSR sidebar chrome for the empty home. Real history and settings stay in
 * Menu.client until the user shows intent (hover, focus, or open).
 */
import { classNames } from '~/utils/classNames';

export function SidebarShell({ onIntent }: { onIntent?: () => void }) {
  return (
    <aside
      data-testid="app-sidebar"
      aria-label="Sidebar"
      onPointerEnter={onIntent}
      onFocusCapture={onIntent}
      className={classNames(
        'hidden shrink-0 flex-col border-r border-hype-border bg-hype-surface text-sm text-hype-text lg:flex',
        'lg:w-[var(--hype-sidebar-width)]',
      )}
    >
      <div className="flex h-[var(--header-height)] items-center gap-2 border-b border-hype-border px-3">
        <a href="/" className="flex min-w-0 items-center gap-2 text-hype-text">
          <img src="/favicon.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
          <span className="truncate text-base font-semibold lowercase tracking-tight">hypeable</span>
        </a>
      </div>
      <div className="p-3">
        <a
          href="/"
          title="New build"
          className="flex items-center justify-center gap-2 rounded-[var(--hype-radius-md)] bg-hype-accent px-3 py-2 text-sm font-medium text-hype-on-accent hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
        >
          <span className="i-ph:plus-circle h-4 w-4" aria-hidden="true" />
          <span>New build</span>
        </a>
      </div>
    </aside>
  );
}
