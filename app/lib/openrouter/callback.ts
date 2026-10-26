/**
 * Capture the OAuth callback query and strip it from the URL before React
 * renders. The first HTML request still contains `?code=` (OAuth redirect);
 * after this runs, history and subsequent requests do not.
 */
import { CALLBACK_STASH_KEY, OPENROUTER_CALLBACK_PATH, type OpenRouterCallbackParams } from './constants';

export type LocationLike = {
  href: string;
  pathname: string;
  search: string;
};

export type HistoryLike = {
  replaceState: (data: unknown, unused: string, url?: string | null) => void;
};

type StashHolder = {
  [CALLBACK_STASH_KEY]?: OpenRouterCallbackParams;
};

export type CallbackWindow = {
  location: LocationLike;
  history: HistoryLike;
} & StashHolder;

let captured: OpenRouterCallbackParams | undefined;

function emptyParams(): OpenRouterCallbackParams {
  return { code: null, state: null, error: null };
}

export function readCallbackParams(url: URL): OpenRouterCallbackParams {
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
  };
}

export function stripCallbackSearch(pathname: string): string {
  return pathname || OPENROUTER_CALLBACK_PATH;
}

export function captureAndStripCallbackUrl(location: LocationLike, history: HistoryLike): OpenRouterCallbackParams {
  const url = new URL(location.href);
  const params = readCallbackParams(url);

  if (url.search || url.hash) {
    history.replaceState({}, '', stripCallbackSearch(url.pathname));
  }

  return params;
}

export function takeStashedCallback(holder: StashHolder): OpenRouterCallbackParams | undefined {
  const stashed = holder[CALLBACK_STASH_KEY];

  if (!stashed) {
    return undefined;
  }

  delete holder[CALLBACK_STASH_KEY];

  return stashed;
}

/**
 * Idempotent. Prefers the inline-script stash (stripped before React), then
 * the live URL, then a previously captured value from this module.
 */
export function captureCallbackFromWindow(
  win: CallbackWindow = window as unknown as CallbackWindow,
): OpenRouterCallbackParams {
  if (captured) {
    return captured;
  }

  const stashed = takeStashedCallback(win);

  if (stashed) {
    captured = stashed;
    return captured;
  }

  captured = captureAndStripCallbackUrl(win.location, win.history);

  return captured;
}

export function peekCapturedCallback(): OpenRouterCallbackParams {
  return captured ?? emptyParams();
}

/** Test-only: reset the module capture so specs stay isolated. */
export function resetCapturedCallback(): void {
  captured = undefined;
}
