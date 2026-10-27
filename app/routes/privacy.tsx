import type { MetaFunction } from 'react-router';
import { LegalPage } from '~/components/legal/LegalPage';
import { APP_REPO_URL, brandMeta } from '~/utils/brand';

export const meta: MetaFunction = () => brandMeta('Privacy · Hypeable', '/privacy');

export default function Privacy() {
  return (
    <LegalPage crumb="privacy" title="Privacy">
      <p>
        Hypeable is a free, open-source AI app builder. You bring your own API key. We do not run accounts, analytics,
        or a Hypeable-owned database of your projects.
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">What we collect</h2>
      <p>Nothing on a Hypeable server. Builds, keys, spend, and chat history stay in this browser.</p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Keys and tokens</h2>
      <p>
        Model keys and connector tokens live in your browser (<code className="text-hype-text">localStorage</code> or{' '}
        <code className="text-hype-text">sessionStorage</code>). They go only to the provider you chose, over HTTPS, for
        that request. Details:{' '}
        <a className="text-hype-text underline underline-offset-2" href={`${APP_REPO_URL}/blob/main/docs/KEY-FLOW.md`}>
          KEY-FLOW.md
        </a>
        .
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Cloudflare</h2>
      <p>
        We host the public site on Cloudflare. Cloudflare sees normal request metadata (IP address, User-Agent, URL) so
        it can deliver the page and apply rate limits. Cloudflare may set its own cookies for that delivery. We do not
        use them for accounts or analytics, and we send{' '}
        <code className="text-hype-text">Cache-Control: no-store, no-transform</code> so Cloudflare cannot inject its
        Web Analytics beacon into our HTML.
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Providers you choose</h2>
      <p>
        Your model provider sees the prompts, files, and key you send it. OpenRouter sees the same if you Connect with
        OpenRouter. GitHub, GitLab, Vercel, and Netlify see whatever you publish to <em>your</em> account with{' '}
        <em>your</em> token.
      </p>

      <h2 className="pt-4 text-base font-semibold text-hype-text">Cookies we set</h2>
      <p>
        We do not set tracking cookies. The app does set first-party preference cookies in your browser:{' '}
        <code className="text-hype-text">selectedProvider</code>, <code className="text-hype-text">selectedModel</code>,{' '}
        <code className="text-hype-text">providers</code> (which local/custom endpoints are on),{' '}
        <code className="text-hype-text">cachedPrompt</code> (the draft in the box),{' '}
        <code className="text-hype-text">agentMode</code>, <code className="text-hype-text">isDebugEnabled</code>, and{' '}
        <code className="text-hype-text">eventLogs</code>. Keys are not cookies. Theme is{' '}
        <code className="text-hype-text">localStorage</code>, not a cookie.
      </p>
    </LegalPage>
  );
}
