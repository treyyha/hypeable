import { describe, expect, it } from 'vitest';
import {
  getGithubAccessToken,
  getNetlifyAccessToken,
  getSupabaseAccessToken,
  getVercelAccessToken,
} from './connector-tokens';

const FAKE_TOKEN = 'test-connector-token-not-a-secret';
const COOKIE_TOKEN = 'test-cookie-token-must-be-ignored';

function requestWith(headers: Record<string, string>): Request {
  return new Request('https://example.com/api/github-user', { headers });
}

describe('connector token readers', () => {
  it('reads GitHub tokens from Authorization or the body, never the githubToken cookie', () => {
    const cookieRequest = requestWith({
      Cookie: `githubToken=${COOKIE_TOKEN}`,
      Authorization: `Bearer ${FAKE_TOKEN}`,
    });

    expect(getGithubAccessToken(cookieRequest, {})).toBe(FAKE_TOKEN);
    expect(getGithubAccessToken(requestWith({ Cookie: `githubToken=${COOKIE_TOKEN}` }), {})).toBeUndefined();
    expect(getGithubAccessToken(requestWith({}), {}, FAKE_TOKEN)).toBe(FAKE_TOKEN);
  });

  it('prefers a body token, then Authorization, then env', () => {
    const request = requestWith({ Authorization: 'Bearer from-header' });

    expect(getGithubAccessToken(request, { GITHUB_TOKEN: 'from-env' }, 'from-body')).toBe('from-body');
    expect(getGithubAccessToken(request, { GITHUB_TOKEN: 'from-env' })).toBe('from-header');
    expect(getGithubAccessToken(requestWith({}), { GITHUB_ACCESS_TOKEN: 'from-env' })).toBe('from-env');
  });

  it('reads Vercel, Netlify, and Supabase tokens the same way', () => {
    const request = requestWith({ Authorization: `Bearer ${FAKE_TOKEN}` });

    expect(getVercelAccessToken(request, {})).toBe(FAKE_TOKEN);
    expect(getNetlifyAccessToken(request, {})).toBe(FAKE_TOKEN);
    expect(getSupabaseAccessToken(request, {})).toBe(FAKE_TOKEN);
    expect(getVercelAccessToken(requestWith({ Cookie: 'VITE_VERCEL_ACCESS_TOKEN=cookie' }), {})).toBeUndefined();
  });
});
