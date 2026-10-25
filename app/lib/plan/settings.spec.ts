import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN_SETTINGS, normalizePlanSettings, readPlanSettings } from './settings';

describe('plan settings', () => {
  it('defaults to plan mode on and plan-every-request off', () => {
    expect(normalizePlanSettings(undefined)).toEqual(DEFAULT_PLAN_SETTINGS);
    expect(readPlanSettings('not-json')).toEqual(DEFAULT_PLAN_SETTINGS);
    expect(readPlanSettings('{"enabled":false,"everyRequest":true}')).toEqual({
      enabled: false,
      everyRequest: true,
    });
  });
});
