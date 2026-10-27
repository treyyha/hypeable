/**
 * Empty-home first-run card. SSR so a first visit paints it with the hero.
 * Dismissal is localStorage-only; returning visitors hide it before paint.
 */
import { useEffect, useState } from 'react';
import { dismissFirstRun, shouldShowFirstRunCard } from '~/components/onboarding/first-run';
import { Button } from '~/components/ui/Button';
import { startOpenRouterConnect } from '~/lib/openrouter/connect';
import { OPENROUTER_CREDITS_URL, OPENROUTER_KEYS_URL } from '~/lib/openrouter/constants';
import { requestProviderListLoad } from '~/lib/performance/prefetch-home';
import { openModelPicker } from '~/lib/stores/loop';
import { PRIVACY_OPENROUTER } from '~/utils/privacy-copy';

const STEPS = [
  'Connect OpenRouter (one click)',
  'Add a few dollars of credit on openrouter.ai',
  'Describe your app',
] as const;

export function StartInSixty({ hasKeys = false }: { hasKeys?: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!shouldShowFirstRunCard(hasKeys)) {
      setVisible(false);
    }
  }, [hasKeys]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissFirstRun();
        setVisible(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  const dismiss = () => {
    dismissFirstRun();
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="relative z-[1] mx-auto mt-6 w-full px-4" data-first-run-card="">
      <section
        data-testid="start-in-sixty"
        aria-labelledby="start-in-sixty-title"
        className="relative mx-auto w-full max-w-[520px] rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface px-4 py-4 text-left"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            dismiss();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="start-in-sixty-title" className="text-sm font-semibold text-hype-text">
            Start in 60 seconds
          </h2>
          <button
            type="button"
            className="hype-icon-btn shrink-0"
            aria-label="Dismiss start in 60 seconds"
            data-testid="dismiss-start-in-sixty"
            onClick={dismiss}
          >
            <span className="i-ph:x text-lg" aria-hidden="true" />
          </button>
        </div>
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
                      className="text-hype-accent-text underline underline-offset-2"
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
          className="mt-2 appearance-none text-xs text-hype-accent-text underline underline-offset-2"
          data-testid="already-have-key"
          onPointerEnter={() => requestProviderListLoad()}
          onFocus={() => requestProviderListLoad()}
          onClick={() => {
            requestProviderListLoad();
            openModelPicker({ provider: 'OpenRouter' });
          }}
        >
          I already have a key
        </button>
        <p className="mt-3 text-xs text-hype-muted">{PRIVACY_OPENROUTER}</p>
        <p className="mt-1 text-xs text-hype-muted">
          You can set a credit limit on the key at{' '}
          <a
            href={OPENROUTER_KEYS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-hype-accent-text underline underline-offset-2"
          >
            openrouter.ai/settings/keys
          </a>
          .
        </p>
      </section>
    </div>
  );
}
