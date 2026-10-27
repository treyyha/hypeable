import { describe, expect, it } from 'vitest';
import { getVisibleTabs } from './tab-helpers';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';

describe('getVisibleTabs', () => {
  it('hides the plugin marketplace even if an old config still marks it visible', () => {
    // DEFAULT_TAB_CONFIG infers `id` as string; the map is still TabType rows.
    const userTabs = DEFAULT_TAB_CONFIG.map((tab) =>
      tab.id === 'plugins' ? { ...tab, visible: true } : tab,
    ) as TabVisibilityConfig[];

    const tabs = getVisibleTabs({ userTabs }, true);

    expect(tabs.some((tab) => tab.id === 'plugins')).toBe(false);
  });
});
