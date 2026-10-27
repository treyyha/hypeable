import { describe, expect, it } from 'vitest';
import { getVisibleTabs } from './tab-helpers';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';

describe('getVisibleTabs', () => {
  it('hides the plugin marketplace even if an old config still marks it visible', () => {
    const tabs = getVisibleTabs(
      {
        userTabs: [...DEFAULT_TAB_CONFIG, { id: 'plugins', visible: true, window: 'user', order: 9 }],
      },
      true,
    );

    expect(tabs.some((tab) => tab.id === 'plugins')).toBe(false);
  });
});
