/**
 * Honest copy for GitHub / GitLab / Vercel / Netlify / Supabase tokens.
 * Same hop as LLM keys: browser → our server → provider, never stored.
 */
export function ConnectorTokenHint() {
  return (
    <p className="mt-2 text-xs text-bolt-elements-textSecondary">
      Stored in your browser. Sent over HTTPS for the request, never stored or logged.
    </p>
  );
}
