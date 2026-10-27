import { beforeEach, describe, expect, it } from 'vitest';
import {
  homeComposerDraft,
  homeComposerSendNonce,
  requestHomeComposerSend,
  setHomeComposerDraft,
} from './home-composer';

describe('home-composer', () => {
  beforeEach(() => {
    homeComposerDraft.set('');
    homeComposerSendNonce.set(0);
  });

  it('keeps a draft the SSR shell can write before Chat mounts', () => {
    setHomeComposerDraft('Make a recipe finder');
    expect(homeComposerDraft.get()).toBe('Make a recipe finder');
  });

  it('bumps a send nonce so ChatImpl can flush a queued Enter', () => {
    requestHomeComposerSend();
    requestHomeComposerSend();
    expect(homeComposerSendNonce.get()).toBe(2);
  });
});
