/**
 * Map provider/HTTP failures to copy a person can act on. Never forward stack traces.
 */

export type UserErrorKind =
  | 'no_key'
  | 'invalid_key'
  | 'no_credit'
  | 'rate_limit'
  | 'too_large'
  | 'provider_down'
  | 'offline'
  | 'timeout'
  | 'unknown';

export type UserFacingError = {
  kind: UserErrorKind;
  title: string;
  message: string;
};

const COPY: Record<UserErrorKind, UserFacingError> = {
  no_key: {
    kind: 'no_key',
    title: 'Add an API key',
    message: 'Paste a key in Model and key, or connect with OpenRouter. Hypeable does not host a key for you.',
  },
  invalid_key: {
    kind: 'invalid_key',
    title: 'That key was rejected',
    message: 'The provider returned 401. Check the key in Model and key, or create a new one on the provider site.',
  },
  no_credit: {
    kind: 'no_credit',
    title: 'No credit left',
    message: 'The provider says this account is out of credit. Add billing on the provider site, then try again.',
  },
  rate_limit: {
    kind: 'rate_limit',
    title: 'Too many requests',
    message: 'Wait a minute and try again. If this keeps happening, switch model or raise the limit on the provider.',
  },
  too_large: {
    kind: 'too_large',
    title: 'This chat is too big to send',
    message:
      'Each message re-sends the project and the whole conversation, and this one is over the 2 MB limit. Remove large images, or start a new chat from the current files.',
  },
  provider_down: {
    kind: 'provider_down',
    title: 'The provider did not respond',
    message: 'The model service is down or timed out. Retry in a moment, or pick a different model.',
  },
  offline: {
    kind: 'offline',
    title: 'You look offline',
    message: 'Check your connection, then send again. Hypeable cannot reach the model provider without a network.',
  },
  timeout: {
    kind: 'timeout',
    title: 'The provider stopped responding',
    message: 'The request timed out. Completed file changes are kept. Retry, or switch model.',
  },
  unknown: {
    kind: 'unknown',
    title: 'Something went wrong',
    message: 'The request failed. Retry, switch model, or check the provider status page.',
  },
};

export function classifyUserError(input: { statusCode?: number; message?: string; online?: boolean }): UserFacingError {
  if (input.online === false) {
    return COPY.offline;
  }

  const raw = (input.message ?? '').toLowerCase();

  if (raw.includes('no api key') || raw.includes('add an api key') || raw.includes('missing api key')) {
    if (input.statusCode === 401 || raw.includes('invalid')) {
      return COPY.invalid_key;
    }

    return COPY.no_key;
  }

  if (input.statusCode === 401 || raw.includes('invalid or missing api key') || raw.includes('authentication')) {
    return COPY.invalid_key;
  }

  if (
    input.statusCode === 402 ||
    raw.includes('insufficient') ||
    raw.includes('no credit') ||
    raw.includes('credit') ||
    raw.includes('quota')
  ) {
    return COPY.no_credit;
  }

  if (input.statusCode === 429 || raw.includes('rate limit') || raw.includes('too many requests')) {
    return COPY.rate_limit;
  }

  if (input.statusCode === 413 || raw.includes('request body is too large')) {
    return COPY.too_large;
  }

  if (raw.includes('timeout') || raw.includes('timed out') || raw.includes('stopped responding')) {
    return COPY.timeout;
  }

  if (input.statusCode !== undefined && input.statusCode >= 500) {
    return COPY.provider_down;
  }

  if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('offline')) {
    return COPY.offline;
  }

  return COPY.unknown;
}

export function stripStackTrace(text: string): string {
  return text
    .split('\n')
    .filter((line) => !/^\s*at\s+/.test(line))
    .join('\n')
    .trim();
}
