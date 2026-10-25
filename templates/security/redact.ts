// Use around ANY logging so keys never reach logs.
const PATTERNS = [/sk-ant-[A-Za-z0-9_-]+/g, /sk-[A-Za-z0-9_-]{20,}/g, /gh[pousr]_[A-Za-z0-9]{20,}/g, /Bearer\s+[A-Za-z0-9._-]+/gi];
export const redact = (s: string) => PATTERNS.reduce((acc, re) => acc.replace(re, '[REDACTED]'), s);
export const safeLog = (...a: unknown[]) => console.log(...a.map((x) => redact(typeof x === 'string' ? x : JSON.stringify(x))));
