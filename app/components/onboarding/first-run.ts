/**
 * First-run card visibility. Dismissal lives in localStorage only — never a
 * cookie — so a first HTML response can still paint the card, then an inline
 * script hides it before paint for returning visitors.
 */
export const FIRST_RUN_DISMISSED_KEY = 'bolt_onboarding_completed';

/** Matches `API_KEYS_STORAGE_KEY` without importing the storage module into root. */
export const FIRST_RUN_KEYS_STORAGE_KEY = 'hypeable_api_keys';

export const FIRST_RUN_DONE_DATASET = 'firstRun';

export function readFirstRunDismissed(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(FIRST_RUN_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissFirstRun(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(FIRST_RUN_DISMISSED_KEY, 'true');
    document.documentElement.dataset[FIRST_RUN_DONE_DATASET] = 'done';
  } catch {
    // Private mode should not break the home page.
  }
}

export function storedKeyCount(raw: string | null): number {
  if (!raw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 0;
    }

    return Object.keys(parsed).length;
  } catch {
    return 0;
  }
}

export function shouldShowFirstRunCard(hasKeys: boolean): boolean {
  return !hasKeys && !readFirstRunDismissed();
}
