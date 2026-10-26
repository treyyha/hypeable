import { describe, expect, it } from 'vitest';
import { publishActionEnabled, publishActionLabel, showPublishAnyway, showRiskCheckbox } from './gating';

describe('predeploy modal gating', () => {
  it('requires the risk checkbox only for FAIL', () => {
    expect(showRiskCheckbox('fail')).toBe(true);
    expect(showRiskCheckbox('warn')).toBe(false);
    expect(showRiskCheckbox('pass')).toBe(false);
    expect(publishActionEnabled('fail', false)).toBe(false);
    expect(publishActionEnabled('fail', true)).toBe(true);
    expect(publishActionEnabled('warn', false)).toBe(true);
    expect(publishActionEnabled('pass', false)).toBe(true);
  });

  it('labels warn/fail as publish anyway and pass as continue', () => {
    expect(publishActionLabel('pass')).toBe('Continue');
    expect(publishActionLabel('warn')).toBe('Publish anyway');
    expect(publishActionLabel('fail')).toBe('Publish anyway');
    expect(showPublishAnyway('warn')).toBe(true);
    expect(showPublishAnyway('fail')).toBe(true);
    expect(showPublishAnyway('pass')).toBe(false);
  });
});
