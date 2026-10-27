import type { Page } from '@playwright/test';

/** Fake OpenAI-style key, short enough that secret-scan does not treat it as real. */
export const E2E_FAKE_KEY = 'sk-testkeytestkeytestkey12';

export const MOCK_OPENAI_ORIGIN = 'http://127.0.0.1:8787';
export const MOCK_OPENAI_BASE_URL = `${MOCK_OPENAI_ORIGIN}/v1`;

export const PROVIDER_SETTINGS_STORAGE_KEY = 'provider_settings';
export const API_KEYS_STORAGE_KEY = 'hypeable_api_keys';
export const COST_STORAGE_KEY = 'hypeable:cost:v1';
export const PLAN_SETTINGS_KEY = 'hypeable:plan:v1';
export const ONBOARDING_COMPLETED_KEY = 'bolt_onboarding_completed';
export const SELECTED_MODEL_STORAGE_KEY = 'hypeable:pref:selectedModel';
export const SELECTED_PROVIDER_STORAGE_KEY = 'hypeable:pref:selectedProvider';

function localDayKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function costSnapshotWithMockPrice(now = new Date()) {
  return {
    version: 1,
    sessionId: 's-e2e-smoke',
    sessionStartedAt: now.getTime(),
    sessionTotal: 0,
    sessionPromptTokens: 0,
    sessionCompletionTokens: 0,
    dayKey: localDayKey(now),
    dailyTotal: 0,
    dailyPromptTokens: 0,
    dailyCompletionTokens: 0,
    messages: {},
    byModel: {},
    caps: { session: 2, daily: 10 },
    // $50 / $150 per million tokens so 3k mock tokens display well above $0.000.
    customPrices: { 'mock-model': { input: 50, output: 150 } },
    warned80Session: false,
    warned80Daily: false,
  };
}

/**
 * Writes the same keys the app uses: localStorage for BYO keys, OpenAILike
 * settings, cost prices, and the selected provider/model. No cookies.
 */
export async function seedOpenAILikeMock(page: Page): Promise<void> {
  const payload = {
    fakeKey: E2E_FAKE_KEY,
    baseUrl: MOCK_OPENAI_BASE_URL,
    keysStorage: API_KEYS_STORAGE_KEY,
    providersStorage: PROVIDER_SETTINGS_STORAGE_KEY,
    costStorage: COST_STORAGE_KEY,
    planStorage: PLAN_SETTINGS_KEY,
    onboardingKey: ONBOARDING_COMPLETED_KEY,
    modelStorage: SELECTED_MODEL_STORAGE_KEY,
    providerStorage: SELECTED_PROVIDER_STORAGE_KEY,
    costSnapshot: costSnapshotWithMockPrice(),
  };

  await page.addInitScript((seed) => {
    localStorage.setItem(seed.keysStorage, JSON.stringify({ OpenAILike: seed.fakeKey }));
    localStorage.setItem(
      seed.providersStorage,
      JSON.stringify({ OpenAILike: { settings: { enabled: true, baseUrl: seed.baseUrl } } }),
    );
    localStorage.setItem(seed.costStorage, JSON.stringify(seed.costSnapshot));
    localStorage.setItem(seed.planStorage, JSON.stringify({ enabled: true, everyRequest: false }));
    localStorage.setItem(seed.onboardingKey, 'true');
    localStorage.setItem(seed.modelStorage, 'mock-model');
    localStorage.setItem(seed.providerStorage, 'OpenAILike');
  }, payload);
}

/** React has attached home-shell handlers (chips, OpenRouter connect). */
export async function waitForHomeHydrated(page: Page): Promise<void> {
  await page.locator('[data-home-hydrated="true"]').waitFor({ state: 'visible', timeout: 20_000 });
}

/** ChatImpl has replaced the SSR shell, so send/model/key handlers are live. */
export async function waitForChatReady(page: Page): Promise<void> {
  await page.locator('[data-chat-ready="true"]').waitFor({ state: 'visible', timeout: 20_000 });
}

/** debugStarted / a real chat has flipped the empty-home layout off. */
export async function waitForChatStarted(page: Page): Promise<void> {
  await page.locator('[data-chat-started="true"]').waitFor({ state: 'visible', timeout: 20_000 });
}
