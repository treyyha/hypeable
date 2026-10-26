/**
 * Connector tokens (GitHub/GitLab/Vercel/Netlify/Supabase) are not LLM keys.
 * They travel in Authorization or the JSON body, never cookies — cookies
 * attach to every same-origin request, including static assets.
 *
 * Never fall back to process.env / Worker env. A hosted Worker that had
 * VERCEL_TOKEN set would otherwise publish into the operator's account.
 * Self-host auto-connect still works: the client reads VITE_* at build time
 * and sends the user's token per request.
 */

function bearerToken(request: Request): string | undefined {
  const auth = request.headers.get('Authorization');

  if (!auth) {
    return undefined;
  }

  if (auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length);
  }

  if (auth.startsWith('token ')) {
    return auth.slice('token '.length);
  }

  return undefined;
}

function privateToken(request: Request): string | undefined {
  const value = request.headers.get('PRIVATE-TOKEN');
  return value && value.length > 0 ? value : undefined;
}

function firstDefined(...values: Array<string | undefined | null>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0) ?? undefined;
}

export function getGithubAccessToken(
  request: Request,
  _env?: Record<string, string | undefined>,
  bodyToken?: string,
): string | undefined {
  return firstDefined(bodyToken, bearerToken(request));
}

export function getVercelAccessToken(
  request: Request,
  _env?: Record<string, string | undefined>,
  bodyToken?: string,
): string | undefined {
  return firstDefined(bodyToken, bearerToken(request));
}

export function getNetlifyAccessToken(
  request: Request,
  _env?: Record<string, string | undefined>,
  bodyToken?: string,
): string | undefined {
  return firstDefined(bodyToken, bearerToken(request));
}

export function getSupabaseAccessToken(
  request: Request,
  _env?: Record<string, string | undefined>,
  bodyToken?: string,
): string | undefined {
  return firstDefined(bodyToken, bearerToken(request));
}

export function getGitlabAccessToken(
  request: Request,
  _env?: Record<string, string | undefined>,
  bodyToken?: string,
): string | undefined {
  return firstDefined(bodyToken, bearerToken(request), privateToken(request));
}
