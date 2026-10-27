import { beforeEach, describe, expect, it } from 'vitest';
import { closeSettingsPanel, openSettingsPanel, settingsPanelStore } from './settings-panel';

describe('settings-panel', () => {
  beforeEach(() => {
    closeSettingsPanel();
  });

  it('remembers an open request until Menu can mount ControlPanel', () => {
    openSettingsPanel('connectors');
    expect(settingsPanelStore.get()).toEqual({ open: true, tab: 'connectors' });
    closeSettingsPanel();
    expect(settingsPanelStore.get()).toEqual({ open: false });
  });
});
