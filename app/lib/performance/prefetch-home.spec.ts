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

  it('exposes a picker loader without importing provider-list in unit tests', () => {
    expect(typeof requestProviderListLoad).toBe('function');
  });
});
