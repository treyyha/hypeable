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

  it('exposes a picker loader that also requests Chat', () => {
    /*
     * Do not call requestProviderListLoad() here: it dynamic-imports
     * provider-list (LLM SDKs) and Vitest tears down jsdom before that
     * graph finishes loading.
     */
    expect(typeof requestProviderListLoad).toBe('function');
    requestHomeChatLoad();
    expect(homeChatShouldLoad.get()).toBe(true);
  });
});
