/**
 * Connector tokens (GitHub/Vercel/Netlify/Supabase) are not LLM keys.
 * They travel in Authorization or the JSON body, never cookies — cookies
 * attach to every same-origin request, including static assets.
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

function firstDefined(...values: Array<string | undefined | null>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0) ?? undefined;
}

function envValue(env: Record<string, string | undefined> | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const fromEnv = env?.[key] || process.env[key];

    if (fromEnv) {
      return fromEnv;
    }
  }

  return undefined;
}

export function getGithubAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
  bodyToken?: string,
): string | undefined {
  return firstDefined(
    bodyToken,
    bearerToken(request),
    envValue(env, 'GITHUB_TOKEN', 'GITHUB_ACCESS_TOKEN', 'VITE_GITHUB_ACCESS_TOKEN'),
  );
}

export function getVercelAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
  bodyToken?: string,
): string | undefined {
  return firstDefined(bodyToken, bearerToken(request), envValue(env, 'VITE_VERCEL_ACCESS_TOKEN', 'VERCEL_TOKEN'));
}

export function getNetlifyAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
  bodyToken?: string,
): string | undefined {
  return firstDefined(
    bodyToken,
    bearerToken(request),
    envValue(env, 'VITE_NETLIFY_ACCESS_TOKEN', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_TOKEN'),
  );
}

export function getSupabaseAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
  bodyToken?: string,
): string | undefined {
  return firstDefined(
    bodyToken,
    bearerToken(request),
    envValue(env, 'VITE_SUPABASE_ACCESS_TOKEN', 'SUPABASE_ACCESS_TOKEN'),
  );
}
