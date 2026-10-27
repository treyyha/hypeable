/**
 * Honest copy for GitHub / GitLab / Vercel / Netlify / Supabase tokens.
 * GitHub/GitLab publish skip our Worker; Vercel/Netlify/Supabase and hosted
 * model calls do not.
 */
import { PRIVACY_CONNECTOR_HINT } from '~/utils/privacy-copy';

export function ConnectorTokenHint() {
  return <p className="mt-2 text-xs text-bolt-elements-textSecondary">{PRIVACY_CONNECTOR_HINT}</p>;
}
