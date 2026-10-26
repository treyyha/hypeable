/**
 * Shows the Connect success/error toast after returning from OpenRouter,
 * and opens the key dialog when the callback asked for the paste fallback.
 */
import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { takeOpenModelPicker, takeOpenRouterToast } from '~/lib/openrouter/connect';
import { openModelPicker } from '~/lib/stores/loop';

export function OpenRouterToastHost() {
  useEffect(() => {
    const queued = takeOpenRouterToast();

    if (queued?.kind === 'success') {
      toast.success(queued.message || 'Connected to OpenRouter. The key stays in this browser.');
    } else if (queued?.kind === 'error' && queued.message) {
      toast.error(queued.message);
    }

    if (takeOpenModelPicker()) {
      openModelPicker({ provider: 'OpenRouter' });
    }
  }, []);

  return null;
}
