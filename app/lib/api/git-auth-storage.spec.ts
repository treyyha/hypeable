import { describe, expect, it } from 'vitest';
import { authorizationHeaders } from './git-auth-storage';

describe('authorizationHeaders', () => {
  it('sends a Bearer header and omits the header when there is no token', () => {
    expect(authorizationHeaders('test-connector-token-not-a-secret')).toEqual({
      Authorization: 'Bearer test-connector-token-not-a-secret',
    });
    expect(authorizationHeaders()).toEqual({});
    expect(authorizationHeaders('')).toEqual({});
  });
});
