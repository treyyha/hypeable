/**
 * OpenAILike (and other URL-configurable providers) need a base URL on the
 * server. That used to travel only in the `providers` cookie, which is written
 * from a useEffect and can miss the first /api/models fetch. LLM requests now
 * send the same payload in `x-hypeable-providers` as well.
 */
import { getProviderSettingsFromCookie, safeJsonParse } from '~/lib/api/cookies';
import { readEncodedJsonHeader } from '~/lib/api/request-keys';
import type { IProviderSetting } from '~/types/model';

export const HYPEABLE_PROVIDERS_HEADER = 'x-hypeable-providers';

export const PROVIDER_SETTINGS_STORAGE_KEY = 'provider_settings';

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Accept both the cookie shape `{ OpenAILike: { enabled, baseUrl } }` and the
 * localStorage store shape `{ OpenAILike: { settings: { enabled, baseUrl } } }`.
 */
export function asProviderSettings(value: unknown): Record<string, IProviderSetting> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const out: Record<string, IProviderSetting> = {};

  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      continue;
    }

    const row = raw as Record<string, unknown>;

    const nested =
      row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
        ? (row.settings as Record<string, unknown>)
        : row;

    const settings: IProviderSetting = {};
    const enabled = asOptionalBoolean(nested.enabled);
    const baseUrl = asOptionalString(nested.baseUrl);
    const models = asOptionalString(nested.OPENAI_LIKE_API_MODELS);

    if (enabled !== undefined) {
      settings.enabled = enabled;
    }

    if (baseUrl !== undefined) {
      settings.baseUrl = baseUrl;
    }

    if (models !== undefined) {
      settings.OPENAI_LIKE_API_MODELS = models;
    }

    if (Object.keys(settings).length > 0) {
      out[name] = settings;
    }
  }

  return out;
}

export function encodeProviderSettingsHeader(settings: Record<string, IProviderSetting>): string | undefined {
  if (Object.keys(settings).length === 0) {
    return undefined;
  }

  return encodeURIComponent(JSON.stringify(settings));
}

export function getProviderSettingsFromRequest(request: Request): Record<string, IProviderSetting> {
  const fromHeader = asProviderSettings(readEncodedJsonHeader(request.headers, HYPEABLE_PROVIDERS_HEADER));

  if (Object.keys(fromHeader).length > 0) {
    return fromHeader;
  }

  return asProviderSettings(getProviderSettingsFromCookie(request.headers.get('Cookie')));
}

/**
 * Browser-only. Reads the live store snapshot, then the providers cookie.
 * Safe to call during SSR: returns {}.
 */
export function readClientProviderSettings(): Record<string, IProviderSetting> {
  if (typeof window === 'undefined') {
    return {};
  }

  const fromStorage = asProviderSettings(
    safeJsonParse<unknown>(window.localStorage.getItem(PROVIDER_SETTINGS_STORAGE_KEY), {}),
  );

  if (Object.keys(fromStorage).length > 0) {
    return fromStorage;
  }

  try {
    const match = document.cookie.match(/(?:^|; )providers=([^;]*)/);
    const raw = match?.[1] ? decodeURIComponent(match[1]) : undefined;

    return asProviderSettings(safeJsonParse<unknown>(raw, {}));
  } catch {
    return {};
  }
}
