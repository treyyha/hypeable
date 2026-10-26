import { describe, expect, it } from 'vitest';
import { cleanFixture, secretLeakFixture } from './fixtures';
import { assertPredeployClearance } from './server-gate';

describe('assertPredeployClearance', () => {
  it('allows a clean project without acknowledgement', () => {
    const result = assertPredeployClearance(cleanFixture, false);
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('pass');
  });

  it('blocks FAIL findings until the risk is acknowledged', () => {
    const blocked = assertPredeployClearance(secretLeakFixture, false);
    expect(blocked.ok).toBe(false);

    if (blocked.ok) {
      return;
    }

    expect(blocked.status).toBe(403);
    expect(blocked.outcome).toBe('fail');

    const allowed = assertPredeployClearance(secretLeakFixture, true);
    expect(allowed.ok).toBe(true);
    expect(allowed.outcome).toBe('fail');
  });
});
