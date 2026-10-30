/**
 * Supply-chain guards that are easy to lose in a routine dependency or CI edit.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  pnpm?: { onlyBuiltDependencies?: string[] };
};

const workflowDir = join(root, '.github', 'workflows');

const workflows = readdirSync(workflowDir)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(workflowDir, name), 'utf8') }));

describe('supply chain', () => {
  it('only allowlisted packages run install scripts', () => {
    expect(pkg.pnpm?.onlyBuiltDependencies).toEqual(['@parcel/watcher', 'esbuild', 'workerd']);
  });

  it('lockfile entries come from the registry with integrity hashes', () => {
    const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
    const resolutions = lock.match(/resolution: \{[^}]*\}/g) ?? [];

    expect(resolutions.length).toBeGreaterThan(100);

    for (const resolution of resolutions) {
      expect(resolution, resolution).toMatch(/integrity: sha512-/);
      expect(resolution, resolution).not.toMatch(/tarball:|repo:|commit:/);
    }
  });

  for (const { name, text } of workflows) {
    describe(name, () => {
      it('pins every action to a full commit SHA', () => {
        for (const [, ref] of text.matchAll(/uses:\s*([^\s#]+)/g)) {
          expect(ref, ref).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
        }
      });

      it('never runs fork code with secrets or write tokens', () => {
        expect(text).not.toMatch(/pull_request_target|workflow_run/);
        expect(text).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
        expect(text).not.toMatch(/:\s*write-all|contents:\s*write/);
      });

      it('does not interpolate event data into shell scripts', () => {
        const runBlocks = text.match(/run:\s*(?:\|[^\n]*\n(?:\s{8,}.*\n?)*|.*)/g) ?? [];

        for (const block of runBlocks) {
          expect(block, block).not.toMatch(/\$\{\{\s*github\.(event|head_ref)/);
        }
      });
    });
  }
});
