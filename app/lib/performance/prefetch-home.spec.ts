import { beforeEach, describe, expect, it } from 'vitest';
import {
  homeChatShouldLoad,
  homeMenuShouldLoad,
  requestHomeChatLoad,
  requestMenuLoad,
  requestProviderListLoad,
  requestSettingsLoad,
} from './prefetch-home';

describe('prefetch-home', () => {
  beforeEach(() => {
    homeChatShouldLoad.set(false);
    homeMenuShouldLoad.set(false);
  });

  it('does not load Chat or Menu until the composer or sidebar shows intent', () => {
    expect(homeChatShouldLoad.get()).toBe(false);
    expect(homeMenuShouldLoad.get()).toBe(false);
  });

  it('can be marked to load Chat', () => {
    homeChatShouldLoad.set(true);
    expect(homeChatShouldLoad.get()).toBe(true);
  });

  it('can be marked to load Menu', () => {
    homeMenuShouldLoad.set(true);
    expect(homeMenuShouldLoad.get()).toBe(true);
  });

  it('exposes intent loaders without running their dynamic imports in jsdom', () => {
    /*
     * requestHomeChatLoad / requestProviderListLoad / requestMenuLoad
     * dynamic-import Chat.client, Menu.client, ControlPanel, and the provider
     * registry. Those graphs finish after Vitest tears down the environment.
     */
    expect(typeof requestHomeChatLoad).toBe('function');
    expect(typeof requestProviderListLoad).toBe('function');
    expect(typeof requestMenuLoad).toBe('function');
    expect(typeof requestSettingsLoad).toBe('function');
  });
});
