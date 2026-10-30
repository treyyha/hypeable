/**
 * XSS payloads through every path that renders model output, file names or
 * error text as HTML on the hypeable.dev origin.
 *
 * Markdown is rendered with the real remark/rehype plugin chain (raw HTML on,
 * as assistant messages use it) via react-dom/server, then the markup is
 * checked for anything that could execute.
 */
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { safeQuickActionUrl } from '~/components/chat/quickActionUrl';
import { escapeHtml } from '~/utils/escapeHtml';
import { rehypePlugins, remarkPlugins } from '~/utils/markdown';

const PAYLOADS = [
  '<script>window.__pwned=1</script>',
  '<img src=x onerror="window.__pwned=1">',
  '<svg onload="window.__pwned=1"><circle/></svg>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>parent.__pwned=1</script>"></iframe>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '[md link](javascript:alert(1))',
  '[md data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '![img](javascript:alert(1))',
  '<details open ontoggle="window.__pwned=1">x</details>',
  '<button formaction="javascript:alert(1)">x</button>',
  '<form action="javascript:alert(1)"><input type=submit></form>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<style>@import "https://evil.example/x.css";</style>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<think><img src=x onerror=alert(1)></think>',
  '<div class="__boltThought__"><img src=x onerror=alert(1)></div>',
  '<div class="__boltArtifact__" data-message-id="x" data-artifact-id="y" onclick="alert(1)"></div>',
  '<button data-bolt-quick-action="true" data-type="link" data-href="javascript:alert(1)" onclick="alert(1)">x</button>',
  '<base href="https://evil.example/">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<link rel="stylesheet" href="https://evil.example/x.css">',
  '<a href="https://ok.example" target="_blank" rel="opener">x</a>',
  '<input autofocus onfocus="alert(1)">',
  '<video><source onerror="alert(1)"></video>',
  '```html\n<script>alert(1)</script>\n```',
];

function render(markdown: string): string {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: remarkPlugins(false), rehypePlugins: rehypePlugins(true) }, markdown),
  );
}

const BLOCKED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'style',
  'base',
  'meta',
  'link',
  'form',
  'input',
  'math',
  'svg',
  'noscript',
  'template',
]);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'data', 'xlink:href', 'poster']);

/** Parse the markup the way a browser would and list anything that could run. */
function executableParts(html: string): string[] {
  const { document } = new JSDOM(`<body>${html}</body>`).window;
  const problems: string[] = [];

  for (const element of document.body.querySelectorAll('*')) {
    const tag = element.tagName.toLowerCase();

    if (BLOCKED_TAGS.has(tag)) {
      problems.push(`<${tag}>`);
    }

    for (const attr of element.attributes) {
      const name = attr.name.toLowerCase();
      const value = attr.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();

      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        problems.push(`${tag}[${name}]`);
      }

      if (URL_ATTRS.has(name) && /^(?:javascript|data|vbscript):/.test(value)) {
        problems.push(`${tag}[${name}=${value}]`);
      }

      if (name === 'rel' && value.includes('opener')) {
        problems.push(`${tag}[rel=opener]`);
      }
    }
  }

  return problems;
}

describe('markdown renderer (assistant messages, raw HTML on)', () => {
  it.each(PAYLOADS)('neutralises %j', (payload) => {
    const html = render(`hello\n\n${payload}\n\nbye`);

    expect(executableParts(html), html).toEqual([]);
  });

  it('the checker itself flags live markup', () => {
    expect(executableParts('<img src=x onerror=alert(1)><a href=" javascript:x">a</a>')).toEqual([
      'img[onerror]',
      'a[href=javascript:x]',
    ]);
  });

  it('keeps ordinary links and formatting', () => {
    const html = render('**bold** and [docs](https://hypeable.dev/privacy)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://hypeable.dev/privacy"');
  });
});

describe('quick-action link', () => {
  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    ' javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'blob:https://hypeable.dev/uuid',
    'file:///etc/passwd',
    42,
    undefined,
  ])('refuses %j', (href) => {
    expect(safeQuickActionUrl(href, 'https://hypeable.dev')).toBeNull();
  });

  it('opens http(s) and relative links', () => {
    expect(safeQuickActionUrl('https://vercel.com/docs', 'https://hypeable.dev')).toBe('https://vercel.com/docs');
    expect(safeQuickActionUrl('/privacy', 'https://hypeable.dev')).toBe('https://hypeable.dev/privacy');
  });
});

describe('text sinks that use innerHTML', () => {
  it('escapeHtml leaves no tag or attribute breakout', () => {
    const name = `"><img src=x onerror=alert(1)>'<script>`;
    const escaped = escapeHtml(name);

    expect(escaped).not.toMatch(/[<>"']/);
  });
});
