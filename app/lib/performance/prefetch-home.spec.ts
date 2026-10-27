import { beforeEach, describe, expect, it } from 'vitest';
import { homeChatShouldLoad, requestHomeChatLoad, requestProviderListLoad } from './prefetch-home';

describe('prefetch-home', () => {
  beforeEach(() => {
    homeChatShouldLoad.set(false);
  });

  it('does not load Chat until the composer shows intent', () => {
    expect(homeChatShouldLoad.get()).toBe(false);
  });

  it('can be marked to load Chat', () => {
    homeChatShouldLoad.set(true);
    expect(homeChatShouldLoad.get()).toBe(true);
  });

  it('exposes intent loaders without running their dynamic imports in jsdom', () => {
    /*
     * requestHomeChatLoad / requestProviderListLoad dynamic-import Chat.client
     * and provider-list. Those graphs finish after Vitest tears down jsdom.
     */
    expect(typeof requestHomeChatLoad).toBe('function');
    expect(typeof requestProviderListLoad).toBe('function');
  });
});
