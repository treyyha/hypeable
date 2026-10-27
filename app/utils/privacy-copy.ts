/**
 * Canonical public wording for where prompts, keys, and data go.
 * Shorten for UI; never reintroduce phrases in docs/banned-privacy-phrases.json.
 */

export const PRIVACY_CLAIM =
  "No accounts and no database. In hosted mode, requests are relayed through our Cloudflare Worker to the provider you choose; we do not store or log prompts, keys or code, and observability is off. Run Hypeable locally to skip our relay. Your provider's own data policy applies to what you send them.";

export const PRIVACY_CLAIM_SHORT =
  "No accounts and no database. Hosted requests relay through our Cloudflare Worker; we do not store or log prompts, keys or code. Run locally to skip the relay. Your provider's data policy applies.";

export const PRIVACY_OPENROUTER =
  "You pay OpenRouter directly. Hosted model requests relay through our Cloudflare Worker; we do not store or log the key. Run locally to skip the relay. OpenRouter's data policy applies to what you send them.";

export const PRIVACY_KEY_HINT =
  'Stored in this browser. Hosted requests relay through our Cloudflare Worker to your provider; we do not store or log keys. Run locally to skip the relay.';

export const PRIVACY_CONNECTOR_HINT =
  'Stored in this browser. GitHub and GitLab publish go from this browser to that provider (CORS). Vercel, Netlify, Supabase, and hosted model calls relay through our Cloudflare Worker. We do not store or log tokens. Run locally to skip the relay.';

export const CLOUDFLARE_METADATA_CLAIM =
  'Cloudflare, as our host, handles request metadata and sees traffic in transit.';

export const STACKBLITZ_UNAUDITED_CLAIM =
  'After the first build, the in-browser runtime (WebContainer) and preview frames load from StackBlitz-hosted domains. We have not audited what StackBlitz sees.';
