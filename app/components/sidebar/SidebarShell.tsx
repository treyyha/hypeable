/**
 * SSR sidebar chrome for the empty home. Real history and settings stay in
 * Menu.client until the user shows intent (hover, focus, or open).
 *
 * Closed: `hidden lg:flex` so it is gone below 1024px.
 * Open on mobile: a fixed drawer that starts below the header so the
 * hamburger (now an X) stays visible and clickable. Do not put an
 * unlayered `flex` on the closed state — it wins over `hidden`.
 */
import { useStore } from '@nanostores/react';
import { sidebarMobileOpenStore, setSidebarMobileOpen } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';

export function SidebarShell({ onIntent }: { onIntent?: () => void }) {
  const mobileOpen = useStore(sidebarMobileOpenStore);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[var(--header-height)] z-sidebar bg-hype-bg/70 lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarMobileOpen(false)}
        />
      ) : null}
      <aside
        data-testid="app-sidebar"
        aria-label="Sidebar"
        onPointerEnter={onIntent}
        onFocusCapture={onIntent}
        className={classNames(
          'shrink-0 flex-col border-r border-hype-border bg-hype-surface text-sm text-hype-text',
          mobileOpen
            ? 'fixed bottom-0 left-0 top-[var(--header-height)] z-max flex w-[var(--hype-sidebar-width)] lg:static lg:inset-auto lg:z-sidebar'
            : 'hidden lg:flex',
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
    </>
  );
}
