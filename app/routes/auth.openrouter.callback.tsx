/**
 * OpenRouter OAuth callback. The inline script in root.tsx strips `?code=`
 * before React hydrates. This route validates state, exchanges in the browser,
 * stores the key like a pasted OpenRouter key, then returns home.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/Button';
import { ErrorState } from '~/components/ui/ErrorState';
import { LoadingState } from '~/components/ui/LoadingState';
import { captureCallbackFromWindow } from '~/lib/openrouter/callback';
import {
  applyOpenRouterKey,
  finishPkceSession,
  queueOpenModelPicker,
  queueOpenRouterToast,
  startOpenRouterConnect,
} from '~/lib/openrouter/connect';
import { OPENROUTER_CALLBACK_PATH } from '~/lib/openrouter/constants';
import { exchangeOpenRouterCode } from '~/lib/openrouter/exchange';
import { assertCallbackState, readPkceSession } from '~/lib/openrouter/session';

if (typeof window !== 'undefined' && window.location.pathname === OPENROUTER_CALLBACK_PATH) {
  captureCallbackFromWindow();
}

export function HydrateFallback() {
  return <CallbackShell />;
}

export default function OpenRouterCallbackRoute() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = captureCallbackFromWindow();
      const session = readPkceSession(window.sessionStorage);

      try {
        if (params.error) {
          throw new Error('OpenRouter login was cancelled. Paste a key instead.');
        }

        if (!params.code) {
          throw new Error('This login did not return a code. Paste a key instead.');
        }

        assertCallbackState(session?.state, params.state);

        if (!session?.verifier) {
          throw new Error('This login did not start in this tab. Paste a key instead.');
        }

        const { key } = await exchangeOpenRouterCode({ code: params.code, verifier: session.verifier });
        finishPkceSession();
        applyOpenRouterKey(key);
        queueOpenRouterToast('success', 'Connected to OpenRouter. The key stays in this browser.');

        if (!cancelled) {
          window.location.replace('/');
        }
      } catch (err) {
        finishPkceSession();

        const message = err instanceof Error ? err.message : 'Could not finish connecting. Paste a key instead.';

        if (!cancelled) {
          queueOpenRouterToast('error', message);
          setError(message);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4">
        <ErrorState title="Could not connect" description={error} onRetry={() => void startOpenRouterConnect()} />
        <Button
          type="button"
          variant="ghost"
          data-testid="openrouter-paste-fallback"
          onClick={() => {
            queueOpenModelPicker();
            window.location.replace('/');
          }}
        >
          Paste a key instead
        </Button>
        <Link to="/" className="text-xs text-hype-muted underline-offset-2 hover:underline">
          Back to Hypeable
        </Link>
      </main>
    );
  }

  return <CallbackShell />;
}

function CallbackShell() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center px-4">
      <LoadingState label="Connecting to OpenRouter…" />
    </main>
  );
}
