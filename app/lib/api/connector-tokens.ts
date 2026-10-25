/**
 * Connector tokens (GitHub/Vercel/Netlify/Supabase) are not LLM keys.
 * They used to be stuffed into the same `apiKeys` cookie. After that cookie
 * was removed, these routes read a dedicated cookie, Authorization, or env.
 */
import { parseCookies } from '~/lib/api/cookies';

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

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

export function getGithubAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
): string | undefined {
  const cookies = parseCookies(request.headers.get('Cookie'));

  return firstDefined(
    cookies.githubToken,
    bearerToken(request),
    env?.GITHUB_TOKEN,
    env?.VITE_GITHUB_ACCESS_TOKEN,
    process.env.GITHUB_TOKEN,
    process.env.VITE_GITHUB_ACCESS_TOKEN,
  );
}

export function getVercelAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
): string | undefined {
  return firstDefined(
    bearerToken(request),
    env?.VITE_VERCEL_ACCESS_TOKEN,
    env?.VERCEL_TOKEN,
    process.env.VITE_VERCEL_ACCESS_TOKEN,
    process.env.VERCEL_TOKEN,
  );
}

export function getNetlifyAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
): string | undefined {
  return firstDefined(
    bearerToken(request),
    env?.VITE_NETLIFY_ACCESS_TOKEN,
    env?.NETLIFY_AUTH_TOKEN,
    process.env.VITE_NETLIFY_ACCESS_TOKEN,
    process.env.NETLIFY_AUTH_TOKEN,
  );
}

export function getSupabaseAccessToken(
  request: Request,
  env: Record<string, string | undefined> | undefined,
): string | undefined {
  return firstDefined(
    bearerToken(request),
    env?.VITE_SUPABASE_ACCESS_TOKEN,
    env?.SUPABASE_ACCESS_TOKEN,
    process.env.VITE_SUPABASE_ACCESS_TOKEN,
    process.env.SUPABASE_ACCESS_TOKEN,
  );
}
