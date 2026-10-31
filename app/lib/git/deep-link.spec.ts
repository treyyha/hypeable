import { describe, expect, it } from 'vitest';
import { describeSetupCommands, parseGitDeepLink } from './deep-link';

describe('parseGitDeepLink', () => {
  it('returns the full URL and host for the confirm dialog', () => {
    expect(parseGitDeepLink('https://github.com/owner/repo', true)).toEqual({
      ok: true,
      url: 'https://github.com/owner/repo',
      host: 'github.com',
    });
  });

  it('keeps the GitHub/GitLab-only allowlist in hosted mode', () => {
    expect(parseGitDeepLink('https://gitlab.com/group/proj.git', true).ok).toBe(true);
    expect(parseGitDeepLink('https://evil.example/owner/repo', true).ok).toBe(false);
    expect(parseGitDeepLink('https://github.com.evil.example/owner/repo', true).ok).toBe(false);
    expect(parseGitDeepLink('http://github.com/owner/repo', true).ok).toBe(false);
  });

  it('allows any https host locally, and still shows it', () => {
    expect(parseGitDeepLink('https://git.example.org:8443/a/b', false)).toEqual({
      ok: true,
      url: 'https://git.example.org:8443/a/b',
      host: 'git.example.org:8443',
    });
  });

  it('refuses links that hide the real host or carry credentials', () => {
    expect(parseGitDeepLink('https://github.com@evil.example/owner/repo', false).ok).toBe(false);
    expect(parseGitDeepLink('https://user:token@github.com/owner/repo', true).ok).toBe(false);
    expect(parseGitDeepLink('javascript:alert(1)', false).ok).toBe(false);
    expect(parseGitDeepLink('file:///etc/passwd', false).ok).toBe(false);
    expect(parseGitDeepLink('not a url', false).ok).toBe(false);
    expect(parseGitDeepLink(null, false).ok).toBe(false);
  });
});

describe('describeSetupCommands', () => {
  it('lists every command that would run', () => {
    expect(describeSetupCommands({ setupCommand: 'npm install', startCommand: 'npm run dev' })).toEqual([
      'npm install',
      'npm run dev',
    ]);
    expect(describeSetupCommands({})).toEqual([]);
  });
});
