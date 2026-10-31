/**
 * Every `/api/...` URL the app code builds must be a route in `app/routes.ts`.
 * An unregistered target silently 404s (or falls through to the branded 404
 * page), so a button wired to it looks broken rather than failing loudly.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const APP = join(ROOT, 'app');

function registeredPatterns(): RegExp[] {
  const source = readFileSync(join(APP, 'routes.ts'), 'utf8');
  const paths = [...source.matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1]);

  return paths
    .filter((path) => path.startsWith('/api/'))
    .map((path) => {
      const body = path
        .split('/')
        .map((segment) => (segment === '*' ? '.*' : segment.startsWith(':') ? '[^/]+' : segment.replace(/[.]/g, '\\.')))
        .join('/')
        // A trailing splat also matches the bare parent path in React Router.
        .replace(/\/\.\*$/, '(?:/.*)?');

      return new RegExp(`^${body}$`);
    });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(full);
    }

    return /\.(ts|tsx)$/.test(entry.name) && !/\.(spec|test)\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}(])\/\/.*$/gm, '$1');
}

/** Concrete `/api/...` targets: `${expr}` becomes one segment, route patterns are skipped. */
export function apiTargets(source: string): string[] {
  const literals = [...stripComments(source).matchAll(/(['"`])(\/api\/(?:(?!\1)[^\n\\])*)\1/g)].map(
    (match) => match[2],
  );

  return literals
    .map((literal) => literal.replace(/\$\{[^}]*\}/g, 'param').split(/[?#]/)[0])
    .filter((target) => target !== '/api/' && !target.includes('*') && !target.includes(':'));
}

describe('client API targets', () => {
  it('extracts fetch targets the way the app builds them', () => {
    expect(
      apiTargets(
        "fetch('/api/models'); fetch(`/api/models/${name}?x=1`); // fetch('/api/nope')\nconst limits = { '/api/github-*': 1 };",
      ),
    ).toEqual(['/api/models', '/api/models/param']);
  });

  it('only targets routes registered in app/routes.ts', () => {
    const patterns = registeredPatterns();
    const unregistered: string[] = [];

    let scanned = 0;

    for (const file of sourceFiles(APP)) {
      for (const target of apiTargets(readFileSync(file, 'utf8'))) {
        scanned += 1;

        if (!patterns.some((pattern) => pattern.test(target))) {
          unregistered.push(`${relative(ROOT, file).replace(/\\/g, '/')}: ${target}`);
        }
      }
    }

    expect(scanned).toBeGreaterThan(20);
    expect(unregistered).toEqual([]);
  });
});
