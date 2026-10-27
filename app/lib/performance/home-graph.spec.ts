import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function readApp(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('home first-load graph', () => {
  it('keeps the home route free of the onboarding wizard and provider-list', () => {
    const indexSrc = readApp('app/routes/_index.tsx');
    expect(indexSrc).not.toMatch('FirstRunOnboarding');
    expect(indexSrc).not.toMatch('~/utils/provider-list');
    expect(indexSrc).toMatch('SidebarShell');
    expect(indexSrc).toMatch('BaseChat');
  });

  it('keeps the SSR home shell on the first-run card', () => {
    expect(readApp('app/components/chat/BaseChat.tsx')).toMatch('StartInSixty');
  });

  it('keeps the first-run card free of dialogs and LLM SDKs', () => {
    const src = readApp('app/components/onboarding/StartInSixty.tsx');
    expect(src).not.toMatch('provider-list');
    expect(src).not.toMatch('Dialog');
    expect(src).toMatch('Start in 60 seconds');
    expect(src).toMatch('data-first-run-card');
  });

  it('keeps Menu.client off the provider settings graph', () => {
    const src = readApp('app/components/sidebar/Menu.client.tsx');
    expect(src).not.toMatch('provider-list');
    expect(src).not.toMatch("from '~/lib/stores/settings'");
    expect(src).not.toMatch('from "~/lib/stores/settings"');
    expect(src).toMatch("from '~/lib/stores/settings-panel'");
  });
});
