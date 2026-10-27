import { BrandFooter } from '~/components/ui/BrandFooter';
import { APP_WORDMARK } from '~/utils/brand';

export function AppErrorPage({ status = 500, title, detail }: { status?: number; title?: string; detail?: string }) {
  const notFound = status === 404;

  const heading = title ?? (notFound ? 'Page not found' : 'Something went wrong');

  const body =
    detail ??
    (notFound
      ? 'That URL is not a Hypeable page. Head home to start a build.'
      : 'The page failed to load. Try again from home.');

  return (
    <div className="flex min-h-full flex-col bg-hype-bg text-hype-text">
      <header className="flex h-[var(--header-height)] items-center border-b border-hype-border px-3">
        <a href="/" className="lowercase tracking-tight text-hype-muted">
          {APP_WORDMARK}
        </a>
        <span className="mx-2 text-hype-muted" aria-hidden="true">
          /
        </span>
        <span className="text-hype-text">{notFound ? 'not found' : 'error'}</span>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
        <p className="text-xs font-medium uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">{status}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-3 text-sm leading-relaxed text-hype-muted">{body}</p>
        <a
          href="/"
          className="mt-8 inline-flex h-10 w-fit items-center rounded-[var(--hype-radius-md)] bg-hype-accent px-4 text-sm font-medium text-hype-on-accent"
        >
          Back home
        </a>
      </main>
      <BrandFooter />
    </div>
  );
}
