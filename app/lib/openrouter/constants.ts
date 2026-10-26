/**
 * OpenRouter OAuth PKCE endpoints and in-browser storage keys.
 *
 * Protocol: https://openrouter.ai/docs/guides/overview/auth/oauth
 * (verified 2026-10-26). Callbacks are https or http://localhost / 127.0.0.1.
 */
export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
export const OPENROUTER_EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys';
export const OPENROUTER_CALLBACK_PATH = '/auth/openrouter/callback';
export const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/settings/credits';
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/settings/keys';
export const OPENROUTER_PROVIDER = 'OpenRouter';

/** Cheap default after Connect. First static model in the OpenRouter provider. */
export const OPENROUTER_DEFAULT_MODEL = 'z-ai/glm-5.3-flash';
export const OPENROUTER_KEY_LABEL = 'Hypeable';

export const PKCE_VERIFIER_KEY = 'hypeable_or_pkce_verifier';
export const PKCE_STATE_KEY = 'hypeable_or_pkce_state';
export const OPENROUTER_OAUTH_FLAG_KEY = 'hypeable_openrouter_oauth';
export const OPENROUTER_TOAST_KEY = 'hypeable_or_toast';
export const OPENROUTER_OPEN_PICKER_KEY = 'hypeable_or_open_picker';

export const CALLBACK_STASH_KEY = '__HYPEABLE_OR_CB';

export type OpenRouterCallbackParams = {
  code: string | null;
  state: string | null;
  error: string | null;
};

declare global {
  interface Window {
    __HYPEABLE_OR_CB?: OpenRouterCallbackParams;
  }
}
