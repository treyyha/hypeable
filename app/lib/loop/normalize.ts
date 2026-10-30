/**
 * Turn noisy runtime errors into a stable signature so the same failure
 * on a different path, line, or port counts as the same loop.
 */

const ANSI_RE = /\u001B\[[0-9;]*[A-Za-z]/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ISO_TIME_RE = /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g;
const FILE_URL_RE = /file:\/\/\/[^\s)'"]+/gi;
const HTTP_URL_RE = /https?:\/\/[^\s)'"]+/gi;
const WIN_PATH_RE = /[A-Za-z]:\\(?:[^\\:\s)'"]+\\)*[^\\:\s)'"]+/g;
const FILE_REF_RE = /(?:\/|\\)?(?:[\w.+-]+(?:\/|\\))+[\w.+-]+(?:\.\w+)?/g;
const LINE_COL_RE = /:(\d+):(\d+)/g;
const TRAILING_LINE_RE = /:(\d+)(?=\s|$|\)|,)/g;
const LINE_WORD_RE = /\bline\s+\d+\b/gi;
const COLUMN_WORD_RE = /\bcol(?:umn)?\s+\d+\b/gi;
const PAREN_POS_RE = /\(\s*\d+\s*,\s*\d+\s*\)/g;
const PORT_WORD_RE = /\bports?\s*[:=]?\s*\d+\b/gi;
const VERSION_RE = /\bv?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.]+)?\b/gi;
const HEX_ID_RE = /\b0x[0-9a-f]+\b/gi;
const LONG_HEX_RE = /\b[0-9a-f]{8,}\b/gi;
const PLACEHOLDER_LOC_RE = /\b(?:PATH|URL)(?::LINE(?::COL)?)/g;
const PLACEHOLDER_ONLY_RE = /^(?:TIME|ID|HEX|VERSION|PORT|PATH|URL)(?:[=\s:](?:TIME|ID|HEX|VERSION|PORT|PATH|URL))*$/i;

const MEANINGFUL_LINES = 3;

/*
 * FILE_REF_RE backtracks quadratically on a long run of word characters with
 * no slash (a minified line, a base64 blob in a stack trace): 50k chars took
 * over a second on the main thread. The signature only keeps the first three
 * meaningful lines, so a fixed prefix is enough and keeps it deterministic.
 */
const MAX_SIGNATURE_INPUT = 8_000;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

export function normalizeErrorText(raw: string): string {
  const bounded = raw.length > MAX_SIGNATURE_INPUT ? raw.slice(0, MAX_SIGNATURE_INPUT) : raw;
  const stripped = stripAnsi(bounded).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const replaced = stripped
    .replace(LINE_COL_RE, ':LINE:COL')
    .replace(FILE_URL_RE, 'PATH')
    .replace(HTTP_URL_RE, 'URL')
    .replace(WIN_PATH_RE, 'PATH')
    .replace(FILE_REF_RE, 'PATH')
    .replace(PLACEHOLDER_LOC_RE, (match) => (match.startsWith('URL') ? 'URL' : 'PATH'))
    .replace(ISO_TIME_RE, 'TIME')
    .replace(UUID_RE, 'ID')
    .replace(HEX_ID_RE, 'HEX')
    .replace(TRAILING_LINE_RE, ':LINE')
    .replace(LINE_WORD_RE, 'line LINE')
    .replace(COLUMN_WORD_RE, 'column COL')
    .replace(PAREN_POS_RE, '(LINE,COL)')
    .replace(PORT_WORD_RE, 'port PORT')
    .replace(VERSION_RE, 'VERSION')
    .replace(LONG_HEX_RE, 'HEX')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .toLowerCase();

  return replaced;
}

function meaningfulLines(text: string, max = MEANINGFUL_LINES): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !PLACEHOLDER_ONLY_RE.test(line.replace(/^port\s+/i, 'PORT ')))
    .slice(0, max)
    .join('\n');
}

/** FNV-1a 32-bit; signatures are for grouping, not security. */
export function hashText(text: string): string {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export type ErrorSignature = {
  signature: string;
  normalized: string;
  preview: string;
};

export function signatureFromError(raw: string): ErrorSignature {
  const normalized = normalizeErrorText(raw);
  const core = meaningfulLines(normalized);
  const preview = core.slice(0, 500);

  return {
    signature: hashText(core || 'empty'),
    normalized,
    preview: preview || 'unknown error',
  };
}

export function contentHash(filePath: string, content: string): string {
  return hashText(`${filePath}\n${content}`);
}
