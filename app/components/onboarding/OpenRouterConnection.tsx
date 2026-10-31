/**
 * Connected / disconnected OpenRouter state for Settings and the key dialog.
 */
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/Button';
import { TextLink } from '~/components/ui/TextLink';
import { readStoredApiKeys } from '~/lib/api/api-key-storage';
import { API_KEYS_UPDATED_EVENT } from '~/lib/api/apiKeys';
import { disconnectOpenRouter, isOpenRouterOAuthConnected, startOpenRouterConnect } from '~/lib/openrouter/connect';
import { OPENROUTER_KEYS_URL, OPENROUTER_PROVIDER } from '~/lib/openrouter/constants';
import { PRIVACY_OPENROUTER } from '~/utils/privacy-copy';

export function OpenRouterConnection({ compact = false }: { compact?: boolean }) {
  const [hasKey, setHasKey] = useState(() => Boolean(readStoredApiKeys()[OPENROUTER_PROVIDER]));
  const [oauth, setOauth] = useState(() => isOpenRouterOAuthConnected());

  useEffect(() => {
    const sync = () => {
      setHasKey(Boolean(readStoredApiKeys()[OPENROUTER_PROVIDER]));
      setOauth(isOpenRouterOAuthConnected());
    };

    window.addEventListener(API_KEYS_UPDATED_EVENT, sync);

    return () => window.removeEventListener(API_KEYS_UPDATED_EVENT, sync);
  }, []);

  if (!hasKey) {
    return (
      <div
        className={
          compact ? 'space-y-2' : 'rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-surface-2 p-3'
        }
      >
        <Button type="button" size="sm" data-testid="connect-openrouter" onClick={() => void startOpenRouterConnect()}>
          Connect with OpenRouter
        </Button>
        <p className="mt-2 text-xs text-hype-muted">{PRIVACY_OPENROUTER}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="openrouter-connected"
      className={
        compact ? 'space-y-2' : 'rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-surface-2 p-3'
      }
    >
      <p className="text-sm text-hype-text">
        {oauth ? 'Connected via OpenRouter' : 'OpenRouter key saved in this browser'}
      </p>
      <Button
        type="button"
        variant="danger"
        size="sm"
        data-testid="disconnect-openrouter"
        onClick={() => disconnectOpenRouter()}
      >
        Disconnect
      </Button>
      <p className="mt-2 text-xs text-hype-muted">
        Disconnect removes the key from this browser. Revoke it on{' '}
        <TextLink href={OPENROUTER_KEYS_URL} external>
          openrouter.ai/settings/keys
        </TextLink>
        .
      </p>
    </div>
  );
}
