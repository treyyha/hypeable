import { describe, expect, it } from 'vitest';
import { normalizeErrorText, signatureFromError } from './normalize';

const unix = `TypeError: Cannot read properties of undefined (reading 'map')
    at App (/Users/alice/proj/src/App.tsx:12:4)
    at render (https://foo.webcontainer-api.io/src/main.tsx:9:2)`;

const windows = `\u001B[31mTypeError: Cannot read properties of undefined (reading 'map')\u001B[0m
    at App (C:\\Users\\bob\\proj\\src\\App.tsx:44:8)
    at render (https://bar.webcontainer-api.io/src/main.tsx:22:11)`;

describe('error normalisation', () => {
  it('gives the same signature across paths, lines, ports, ids, versions, and ANSI', () => {
    const a = signatureFromError(unix);

    const b = signatureFromError(
      windows.replace('44:8', '90:1') +
        '\nPort: 5173\n2026-10-25T01:02:03.000Z id=0xdeadbeef uuid=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee v18.16.0',
    );

    expect(a.signature).toBe(b.signature);
    expect(a.normalized).not.toMatch(/alice|bob|5173|deadbeef|18\.16\.0/i);
    expect(normalizeErrorText(unix)).toContain('typeerror');
  });

  it('collapses whitespace and hashes only the first meaningful lines', () => {
    const compact = signatureFromError('Error: boom\n    at foo.ts:1:1');
    const padded = signatureFromError('Error: boom\n\n\n    at foo.ts:1:1   ');
    expect(compact.signature).toBe(padded.signature);
  });

  it('produces a different signature for a different error', () => {
    const a = signatureFromError('Error: Cannot find module "react"');
    const b = signatureFromError('Error: listen EADDRINUSE');
    expect(a.signature).not.toBe(b.signature);
  });
});
