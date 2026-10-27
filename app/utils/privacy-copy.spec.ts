import { describe, expect, it } from 'vitest';
import {
  CLOUDFLARE_METADATA_CLAIM,
  PRIVACY_CLAIM,
  PRIVACY_CONNECTOR_HINT,
  PRIVACY_KEY_HINT,
  PRIVACY_OPENROUTER,
  STACKBLITZ_UNAUDITED_CLAIM,
} from './privacy-copy';

describe('privacy copy', () => {
  it('keeps the canonical hosted-relay claim', () => {
    expect(PRIVACY_CLAIM).toContain('No accounts and no database');
    expect(PRIVACY_CLAIM).toContain('relayed through our Cloudflare Worker');
    expect(PRIVACY_CLAIM).toContain('we do not store or log prompts, keys or code');
    expect(PRIVACY_CLAIM).toContain('observability is off');
    expect(PRIVACY_CLAIM).toContain('Run Hypeable locally to skip our relay');
    expect(PRIVACY_CLAIM).toContain("Your provider's own data policy applies");
  });

  it('states Cloudflare metadata and unaudited StackBlitz traffic', () => {
    expect(CLOUDFLARE_METADATA_CLAIM).toContain('handles request metadata');
    expect(STACKBLITZ_UNAUDITED_CLAIM).toContain('We have not audited what StackBlitz sees');
  });

  it('keeps UI shortenings inside the same facts', () => {
    expect(PRIVACY_OPENROUTER).toContain('relay through our Cloudflare Worker');
    expect(PRIVACY_KEY_HINT).toContain('Run locally to skip the relay');
    expect(PRIVACY_CONNECTOR_HINT).toContain('GitHub and GitLab publish');
  });
});
