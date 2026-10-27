import { beforeEach, describe, expect, it } from 'vitest';
import { homeChatShouldLoad, requestHomeChatLoad, requestProviderListLoad } from './prefetch-home';

describe('prefetch-home', () => {
  beforeEach(() => {
    homeChatShouldLoad.set(false);
  });

  it('does not load Chat until the composer shows intent', () => {
    expect(homeChatShouldLoad.get()).toBe(false);
  });

  it('marks Chat to load on composer intent', () => {
    requestHomeChatLoad();
    expect(homeChatShouldLoad.get()).toBe(true);
    requestHomeChatLoad();
    expect(homeChatShouldLoad.get()).toBe(true);
  });

  it('loads Chat when the model picker needs provider-list', () => {
    requestProviderListLoad();
    expect(homeChatShouldLoad.get()).toBe(true);
  });
});
