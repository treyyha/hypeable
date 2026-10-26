import { describe, expect, it } from 'vitest';
import { createCodeVerifier, createPkcePair, createS256Challenge, isValidVerifier } from './pkce';

/** RFC 7636 Appendix B known vector. */
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('OpenRouter PKCE', () => {
  it('creates a high-entropy verifier in the RFC 7636 charset and length', () => {
    const verifier = createCodeVerifier();

    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(isValidVerifier(verifier)).toBe(true);
  });

  it('matches the RFC 7636 S256 known vector', async () => {
    expect(await createS256Challenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it('returns a matching challenge for a generated pair', async () => {
    const pair = await createPkcePair();
    expect(await createS256Challenge(pair.verifier)).toBe(pair.challenge);
    expect(pair.state.length).toBeGreaterThanOrEqual(43);
    expect(pair.verifier).not.toBe(pair.state);
  });
});
