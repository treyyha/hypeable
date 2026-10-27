import { describe, expect, it } from 'vitest';
import { BaseProvider } from './base-provider';

class FakeProvider extends BaseProvider {
  name = 'FakeProvider';
  staticModels = [];
  config = { apiTokenKey: 'FAKE_API_KEY' };
  getModelInstance(): never {
    throw new Error('not implemented');
  }
}

describe('getProviderBaseUrlAndKey', () => {
  const provider = new FakeProvider();

  it('does not use operator env keys when hosted', () => {
    const result = provider.getProviderBaseUrlAndKey({
      apiKeys: {},
      serverEnv: { HYPEABLE_HOSTED: '1', FAKE_API_KEY: 'operator-env-key-value' },
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'FAKE_API_KEY',
    });

    expect(result.apiKey).toBeUndefined();
  });

  it('uses the request key when hosted', () => {
    const result = provider.getProviderBaseUrlAndKey({
      apiKeys: { FakeProvider: 'user-request-key-value' },
      serverEnv: { HYPEABLE_HOSTED: '1', FAKE_API_KEY: 'operator-env-key-value' },
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'FAKE_API_KEY',
    });

    expect(result.apiKey).toBe('user-request-key-value');
  });

  it('still reads env keys when self-hosted', () => {
    const result = provider.getProviderBaseUrlAndKey({
      apiKeys: {},
      serverEnv: { HYPEABLE_SELF_HOSTED: '1', FAKE_API_KEY: 'operator-env-key-value' },
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'FAKE_API_KEY',
    });

    expect(result.apiKey).toBe('operator-env-key-value');
  });
});
