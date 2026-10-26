/**
 * Empty-home "no key yet" panel. One-click OpenRouter connect, then credit,
 * then describe the app. Manual paste stays a secondary link.
 */
import { Button } from '~/components/ui/Button';
import { startOpenRouterConnect } from '~/lib/openrouter/connect';
import { OPENROUTER_CREDITS_URL, OPENROUTER_KEYS_URL } from '~/lib/openrouter/constants';
import { openModelPicker } from '~/lib/stores/loop';

const STEPS = [
  'Connect OpenRouter (one click)',
  'Add a few dollars of credit on openrouter.ai',
  'Describe your app',
] as const;

export function StartInSixty() {
  return (
    <section
      data-testid="start-in-sixty"
      aria-labelledby="start-in-sixty-title"
      className="mx-auto w-full max-w-[520px] rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface px-4 py-4 text-left"
    >
      <h2 id="start-in-sixty-title" className="text-sm font-semibold text-hype-text">
        Start in 60 seconds
      </h2>
      <ol className="mt-3 space-y-2 text-sm text-hype-text">
        {STEPS.map((label, index) => (
          <li key={label} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hype-surface-2 text-[11px] font-medium tabular-nums text-hype-muted"
            >
              {index + 1}
            </span>
            <span>
              {index === 1 ? (
                <>
                  Add a few dollars of credit on{' '}
                  <a
                    href={OPENROUTER_CREDITS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-hype-accent-text underline-offset-2 hover:underline"
                  >
                    openrouter.ai
                  </a>
                </>
              ) : (
                label
              )}
            </span>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        className="mt-4 w-full"
        data-testid="connect-openrouter"
        onClick={() => void startOpenRouterConnect()}
      >
        Connect with OpenRouter
      </Button>
      <button
        type="button"
        className="mt-2 appearance-none text-xs text-hype-accent-text underline-offset-2 hover:underline"
        onClick={() => openModelPicker({ provider: 'OpenRouter' })}
      >
        I already have a key
      </button>
      <p className="mt-3 text-xs text-hype-muted">
        You pay OpenRouter directly. Hypeable never sees your card and does not store your key on a server. The key
        lives in this browser.
      </p>
      <p className="mt-1 text-xs text-hype-muted">
        You can set a credit limit on the key at{' '}
        <a
          href={OPENROUTER_KEYS_URL}
          target="_blank"
          rel="noreferrer"
          className="text-hype-accent-text underline-offset-2 hover:underline"
        >
          openrouter.ai/settings/keys
        </a>
        .
      </p>
    </section>
  );
}
