/** User-visible product identity. Keep internal `bolt-*` identifiers unchanged. */

export const APP_NAME = 'Hypeable';
export const APP_WORDMARK = 'hypeable';
export const APP_TAGLINE = 'worth the hype';
export const APP_DESCRIPTION = 'worth the hype. A free, open-source AI app builder.';
export const APP_AFFILIATION = 'Not affiliated with Lovable, Bolt, or StackBlitz. Built on bolt.diy (MIT).';
export const APP_REPO_URL = 'https://github.com/treyyha/hypeable';
export const APP_ISSUES_URL = 'https://github.com/treyyha/hypeable/issues';
export const APP_SITE_URL = 'https://hypeable.dev';
export const APP_OG_IMAGE = `${APP_SITE_URL}/og.png`;

export function absoluteUrl(path = '/'): string {
  return new URL(path, APP_SITE_URL).href;
}

export function brandMeta(title = APP_NAME, path = '/') {
  const url = absoluteUrl(path);

  return [
    { title },
    { name: 'description', content: APP_DESCRIPTION },
    { tagName: 'link', rel: 'canonical', href: url },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: url },
    { property: 'og:title', content: title },
    { property: 'og:description', content: APP_DESCRIPTION },
    { property: 'og:image', content: APP_OG_IMAGE },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:site_name', content: APP_NAME },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: APP_DESCRIPTION },
    { name: 'twitter:image', content: APP_OG_IMAGE },
  ];
}
