/**
 * Shared helpers for pre-deploy rules.
 */

import type { Finding, PredeployRule, Severity } from './types';

export function linesOf(content: string): string[] {
  return content.split('\n');
}

export function isEnvExample(path: string): boolean {
  return /\.env\.(example|sample|template|schema)$/i.test(path);
}

export function isDotEnv(path: string): boolean {
  const base = path.replace(/\\/g, '/').split('/').pop() ?? path;
  return /^\.env(?!\.example|\.sample|\.template|\.schema)(\.|$)/i.test(base);
}

export function isSqlPath(path: string): boolean {
  return /\.(sql)$/i.test(path) || /(^|\/)supabase\/migrations\//i.test(path);
}

export function isClientPath(path: string, content: string): boolean {
  const normalized = path.replace(/\\/g, '/');

  if (/\.(server|api)\./i.test(normalized)) {
    return false;
  }

  if (/(^|\/)(server|backend|supabase\/functions)(\/|$)/i.test(normalized)) {
    return false;
  }

  if (/(^|\/)(app\/api|pages\/api|api\/)(\/|$)/i.test(normalized)) {
    return false;
  }

  if (content.includes("'use client'") || content.includes('"use client"')) {
    return true;
  }

  if (/\.(tsx|jsx|vue|svelte)$/i.test(normalized)) {
    return true;
  }

  return /(^|\/)(src|app|pages|components|client)(\/)/i.test(normalized) && /\.(ts|js|mts|cts)$/i.test(normalized);
}

export function isServerHandlerPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return (
    /(^|\/)(app\/api|pages\/api|api|server|functions)(\/)/i.test(normalized) ||
    /route\.(ts|js|mjs)$/i.test(normalized) ||
    /\.server\.(ts|js)$/i.test(normalized)
  );
}

export function makeFinding(
  rule: Pick<PredeployRule, 'id' | 'severity' | 'heuristic'>,
  input: {
    file: string;
    line: number;
    maskedSnippet: string;
    why: string;
    fix: string;
    heuristic?: boolean;
  },
): Finding {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    heuristic: input.heuristic ?? rule.heuristic,
    file: input.file,
    line: input.line,
    maskedSnippet: input.maskedSnippet,
    why: input.why,
    fix: input.fix,
  };
}

export function eachLine(
  files: Record<string, string>,
  visit: (file: string, line: number, text: string, content: string) => void,
): void {
  for (const [file, content] of Object.entries(files)) {
    const lines = linesOf(content);

    for (let index = 0; index < lines.length; index += 1) {
      visit(file, index + 1, lines[index] ?? '', content);
    }
  }
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  FAIL: 0,
  WARN: 1,
  INFO: 2,
};
