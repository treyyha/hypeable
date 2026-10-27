import type { MetaFunction } from 'react-router';
import { LegalPage } from '~/components/legal/LegalPage';
import { APP_REPO_URL, brandMeta } from '~/utils/brand';

export const meta: MetaFunction = () => brandMeta('Terms · Hypeable', '/terms');

export default function Terms() {
  return (
    <LegalPage crumb="terms" title="Terms">
      <p>
        Hypeable is released under the{' '}
        <a className="text-hype-text underline underline-offset-2" href={`${APP_REPO_URL}/blob/main/LICENSE`}>
          MIT licence
        </a>
        . It is provided as-is, without warranty of any kind.
      </p>
      <p>
        You are responsible for the API keys you paste, the providers you call, and the bills those providers send you.
        Cost figures in Hypeable are estimates from list prices or a provider-reported cost — they are not invoices.
        Your provider's own data policy applies to what you send them.
      </p>
      <p>
        Publish to GitHub, GitLab, Vercel, and Netlify is experimental. Sites land in <em>your</em> account with{' '}
        <em>your</em> token. Review the pre-deploy check before you ship.
      </p>
      <p>
        <a className="text-hype-text underline underline-offset-2" href="/privacy">
          Privacy
        </a>
      </p>
    </LegalPage>
  );
}
