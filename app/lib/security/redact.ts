/**
 * Redact secrets before they reach logs or error text.
 *
 * Copied from templates/security/redact.ts and extended so header dumps,
 * cookie blobs, and JSON `apiKeys` maps cannot leak a BYO key.
 */

const PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(?:x-hypeable-key|x-api-key|authorization)\s*[:=]\s*[^\s,;]+/gi,
  /(?:apiKeys|githubToken|gitlabToken|netlifyToken|VITE_VERCEL_ACCESS_TOKEN)=([^;]+)/gi,
];

export const redact = (s: string): string => {
  if (typeof s !== 'string') {
    return String(s);
  }

  return PATTERNS.reduce((acc, re) => acc.replace(re, '[REDACTED]'), s);
};

function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    const json = JSON.stringify(value);

    // JSON.stringify(undefined) and some exotic values return undefined, not a string.
    return typeof json === 'string' ? json : String(value);
  } catch {
    return String(value);
  }
}

export function redactUnknown(value: unknown): string {
  return redact(stringifyUnknown(value));
}

export const safeLog = (...a: unknown[]) => console.log(...a.map((x) => redactUnknown(x)));

let installed = false;

/**
 * Wrap console methods so every server log path is redacted, including
 * `console.error` in routes that never import the app logger.
 */
export function installSafeConsole(): void {
  if (installed || typeof console === 'undefined') {
    return;
  }

  installed = true;

  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;

  for (const method of methods) {
    const original = console[method].bind(console);

    console[method] = ((...args: unknown[]) => {
      original(...args.map((arg) => redactUnknown(arg)));
    }) as typeof console.log;
  }
}

if (typeof window === 'undefined') {
  installSafeConsole();
}
