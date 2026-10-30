import type { MetaFunction } from 'react-router';
import { LegalPage } from '~/components/legal/LegalPage';
import { APP_REPO_URL, brandMeta } from '~/utils/brand';
import {
  CLOUDFLARE_METADATA_CLAIM,
  PRIVACY_CLAIM,
  STACKBLITZ_UNAUDITED_CLAIM,
  WEB_SEARCH_CLAIM,
} from '~/utils/privacy-copy';

export const meta: MetaFunction = () => brandMeta('Privacy · Hypeable', '/privacy');

export default function Privacy() {
  return (
    <LegalPage crumb="privacy" title="Privacy">
      <p>{PRIVACY_CLAIM}</p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">What stays in this browser</h2>
      <p>
        Builds, keys, spend, and chat history live in this browser. We do not run accounts, analytics, or a
        Hypeable-owned database of your projects.
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Keys and tokens</h2>
      <p>
        Model keys and connector tokens live in your browser (<code className="text-hype-text">localStorage</code> or{' '}
        <code className="text-hype-text">sessionStorage</code>). On the public site, model requests and some publish
        calls are relayed through our Cloudflare Worker to the provider you chose, over HTTPS, for that request.
        Details:{' '}
        <a className="text-hype-text underline underline-offset-2" href={`${APP_REPO_URL}/blob/main/docs/KEY-FLOW.md`}>
          KEY-FLOW.md
        </a>
        .
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Cloudflare</h2>
      <p>
        {CLOUDFLARE_METADATA_CLAIM} Cloudflare may set its own cookies for that delivery. We do not use them for
        accounts or analytics, and we send <code className="text-hype-text">Cache-Control: no-store, no-transform</code>{' '}
        so Cloudflare cannot inject its Web Analytics beacon into our HTML. Production Worker observability is off (
        <code className="text-hype-text">wrangler.jsonc</code>).
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">StackBlitz WebContainer</h2>
      <p>{STACKBLITZ_UNAUDITED_CLAIM}</p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Providers you choose</h2>
      <p>
        Your model provider sees the prompts, files, and key you send it. OpenRouter sees the same if you Connect with
        OpenRouter. GitHub, GitLab, Vercel, and Netlify see whatever you publish to <em>your</em> account with{' '}
        <em>your</em> token. Their data policies apply to that traffic.
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Web search</h2>
      <p>{WEB_SEARCH_CLAIM}</p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Cookies we set</h2>
      <p>
        We do not set tracking cookies. Hypeable itself does not set first-party cookies for preferences, drafts, or
        logs. Provider, model, agent mode, the composer draft, debug flags, and event logs live in{' '}
        <code className="text-hype-text">localStorage</code>. Keys are not cookies. Theme is{' '}
        <code className="text-hype-text">localStorage</code>. Cloudflare may still set its own cookies to deliver the
        page. Older browsers that still have leftover preference cookies (
        <code className="text-hype-text">selectedProvider</code>, <code className="text-hype-text">selectedModel</code>,{' '}
        <code className="text-hype-text">providers</code>, <code className="text-hype-text">cachedPrompt</code>,{' '}
        <code className="text-hype-text">agentMode</code>, <code className="text-hype-text">isDebugEnabled</code>,{' '}
        <code className="text-hype-text">eventLogs</code>) are copied into{' '}
        <code className="text-hype-text">localStorage</code> on the next visit and those cookies are deleted.
      </p>
    </LegalPage>
  );
}
