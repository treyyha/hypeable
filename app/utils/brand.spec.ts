import { describe, expect, it } from 'vitest';
import { APP_DESCRIPTION, APP_NAME, APP_OG_IMAGE, APP_SITE_URL, absoluteUrl, brandMeta } from './brand';

describe('brandMeta', () => {
  it('emits title, description, canonical, Open Graph, and Twitter tags with absolute URLs', () => {
    expect(brandMeta()).toEqual(
      expect.arrayContaining([
        { title: APP_NAME },
        { name: 'description', content: APP_DESCRIPTION },
        { tagName: 'link', rel: 'canonical', href: `${APP_SITE_URL}/` },
        { property: 'og:url', content: `${APP_SITE_URL}/` },
        { property: 'og:image', content: APP_OG_IMAGE },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: APP_OG_IMAGE },
      ]),
    );
    expect(APP_OG_IMAGE).toBe('https://hypeable.dev/og.png');
  });

  it('uses the spend path for canonical and og:url', () => {
    expect(brandMeta('Spend · Hypeable', '/spend')).toEqual(
      expect.arrayContaining([
        { title: 'Spend · Hypeable' },
        { tagName: 'link', rel: 'canonical', href: 'https://hypeable.dev/spend' },
        { property: 'og:url', content: 'https://hypeable.dev/spend' },
      ]),
    );
  });

  it('builds absolute URLs from the public site origin', () => {
    expect(absoluteUrl('/')).toBe('https://hypeable.dev/');
    expect(absoluteUrl('/spend')).toBe('https://hypeable.dev/spend');
  });

  it('uses per-route titles for git and 404', () => {
    expect(brandMeta('Import from Git · Hypeable', '/git')).toEqual(
      expect.arrayContaining([{ title: 'Import from Git · Hypeable' }]),
    );
    expect(brandMeta('Not found · Hypeable')).toEqual(expect.arrayContaining([{ title: 'Not found · Hypeable' }]));
  });
});
