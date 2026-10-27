import type { ReactNode } from 'react';
import { BrandFooter } from '~/components/ui/BrandFooter';
import { APP_WORDMARK } from '~/utils/brand';

export function LegalPage({ crumb, title, children }: { crumb: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-hype-bg text-hype-text">
      <header className="flex h-[var(--header-height)] items-center border-b border-hype-border px-3">
        <a href="/" className="lowercase tracking-tight text-hype-muted">
          {APP_WORDMARK}
        </a>
        <span className="mx-2 text-hype-muted" aria-hidden="true">
          /
        </span>
        <span className="text-hype-text">{crumb}</span>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-hype-muted">{children}</div>
      </main>
      <BrandFooter />
    </div>
  );
}
