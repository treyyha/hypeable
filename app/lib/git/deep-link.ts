/**
 * `/git?url=` is a link anyone can send. Parse it into something the confirm
 * dialog can show verbatim, and refuse shapes that hide the real host. The
 * hosted git proxy still enforces its own allowlist on the server; the
 * client check only avoids offering a clone that is bound to fail.
 */
import { GIT_PROXY_HOSTS, hostnameAllowed, normalizeHostname } from '~/lib/security/outbound';

export type GitDeepLink = { ok: true; url: string; host: string } | { ok: false; reason: string };

export function parseGitDeepLink(raw: string | null, hosted: boolean): GitDeepLink {
  if (!raw) {
    return { ok: false, reason: 'No repository URL was given.' };
  }

  let parsed: URL;

  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'That is not a valid URL.' };
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && !hosted)) {
    return { ok: false, reason: 'Only https repository URLs can be cloned.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Repository URLs with embedded credentials are not accepted.' };
  }

  const host = normalizeHostname(parsed.hostname);

  if (hosted && !hostnameAllowed(host, GIT_PROXY_HOSTS)) {
    return { ok: false, reason: 'The hosted site can only clone from GitHub or GitLab.' };
  }

  return { ok: true, url: parsed.toString(), host: parsed.port ? `${host}:${parsed.port}` : host };
}

/** Commands from a `boltAction` setup message, for the second confirmation. */
export function describeSetupCommands(commands: { setupCommand?: string; startCommand?: string }): string[] {
  return [commands.setupCommand, commands.startCommand].filter((command): command is string => Boolean(command));
}
