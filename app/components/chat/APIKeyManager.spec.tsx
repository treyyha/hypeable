import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIKeyManager } from './APIKeyManager';
import { API_KEYS_STORAGE_KEY } from '~/lib/api/api-key-storage';
import type { ProviderInfo } from '~/types/model';

const FAKE_KEY = 'sk-testkeytestkeytestkey12';

const provider = { name: 'OpenAILike' } as ProviderInfo;

describe('APIKeyManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify({ OpenAILike: FAKE_KEY }));
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('does not re-push the stored key when setApiKey identity changes', () => {
    const first = vi.fn();
    const { rerender } = render(<APIKeyManager provider={provider} apiKey={FAKE_KEY} setApiKey={first} />);

    expect(first).not.toHaveBeenCalled();

    const second = vi.fn();
    rerender(<APIKeyManager provider={provider} apiKey={FAKE_KEY} setApiKey={second} />);

    expect(second).not.toHaveBeenCalled();
  });
});
