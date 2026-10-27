import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Cookie } from '@playwright/test';
import { ONBOARDING_COMPLETED_KEY, seedOpenAILikeMock } from './seed';

const PROMPT = 'cookie-diet-prompt-7f3c2a1b unique draft';
const FAKE_JWT = ['eyJhbGciOiJub25lIn0', 'eyJzdWIiOiJjb29raWUtZGlldC1maXh0dXJlIn0', 'signaturepaddingx'].join('.');
const FAKE_OAUTH_CODE = 'SplxlOFaRdYsDNy7oauthTestCode99';

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/lib/security/secret-patterns.json'), 'utf8'),
) as { patterns: Array<{ source: string; flags?: string }> };

const KEY_PATTERNS = catalog.patterns.map((row) => new RegExp(row.source, row.flags || ''));

/**
 * Cookies Hypeable itself is allowed to set. Empty: prefs, drafts, and logs
 * live in localStorage. Cloudflare delivery cookies are ignored by name.
 */
const APP_COOKIE_ALLOWLIST: readonly string[] = [];

const LEGACY_PREF_COOKIES = [
  'selectedModel',
  'selectedProvider',
  'providers',
  'cachedPrompt',
  'agentMode',
  'isDebugEnabled',
  'eventLogs',
  'tabConfiguration',
] as const;

const CLOUDFLARE_COOKIE = /^(?:__cf|cf_|_cf)/i;

function appCookies(cookies: Cookie[]): Cookie[] {
  return cookies.filter((cookie) => !CLOUDFLARE_COOKIE.test(cookie.name));
}

function cookieDump(cookies: Cookie[]): string {
  const names = [...new Set(cookies.map((cookie) => cookie.name))].sort();
  return names.length > 0 ? names.join(', ') : '(none)';
}

test.describe('cookie diet', () => {
  test('does not put prompts, keys, tokens, or OAuth codes in cookies', async ({ page, context }) => {
    await seedOpenAILikeMock(page);
    await page.addInitScript(
      ({ onboardingKey, prompt, jwt }) => {
        localStorage.setItem(onboardingKey, 'true');
        document.cookie = `cachedPrompt=${encodeURIComponent(prompt)}; path=/`;
        document.cookie = `eventLogs=${encodeURIComponent(JSON.stringify({ 1: { message: prompt } }))}; path=/`;
        document.cookie = `apiKeys=${encodeURIComponent(JSON.stringify({ OpenAI: jwt }))}; path=/`;
        document.cookie = `selectedModel=mock-model; path=/`;
        document.cookie = `selectedProvider=OpenAILike; path=/`;
      },
      {
        onboardingKey: ONBOARDING_COMPLETED_KEY,
        prompt: PROMPT,
        jwt: FAKE_JWT,
      },
    );

    await context.addCookies([
      { name: 'cachedPrompt', value: encodeURIComponent(PROMPT), url: 'http://localhost:5173' },
      { name: 'eventLogs', value: encodeURIComponent(PROMPT), url: 'http://localhost:5173' },
    ]);

    await page.goto('/');
    await expect(page.locator('header').getByText('hypeable', { exact: true })).toBeVisible();

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill(PROMPT);
    await page.waitForTimeout(1_500);

    const cookies = appCookies(await context.cookies());
    const names = [...new Set(cookies.map((cookie) => cookie.name))].sort();
    const values = cookies.map((cookie) => {
      try {
        return decodeURIComponent(cookie.value);
      } catch {
        return cookie.value;
      }
    });
    const blob = `${names.join('\n')}\n${values.join('\n')}`;

    expect(blob, 'cookie must not contain the composer draft').not.toContain(PROMPT);
    expect(blob, 'cookie must not contain an OAuth code').not.toContain(FAKE_OAUTH_CODE);
    expect(blob, 'cookie must not contain a JWT-like token').not.toContain(FAKE_JWT);
    expect(blob.toLowerCase()).not.toMatch(/[?&]code=[a-z0-9_-]{10,}/i);

    for (const pattern of KEY_PATTERNS) {
      expect(blob, `cookie matched secret-pattern ${pattern}`).not.toMatch(pattern);
    }

    for (const name of LEGACY_PREF_COOKIES) {
      expect(names, `leftover preference cookie ${name} was not deleted`).not.toContain(name);
    }

    expect(names, `Hypeable cookies: ${cookieDump(cookies)}`).toEqual([...APP_COOKIE_ALLOWLIST]);
  });
});
