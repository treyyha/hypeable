/**
 * Loop-breaker knobs. Stored in this browser only; nothing is sent anywhere.
 */

export const DEFAULT_LOOP_THRESHOLD = 3;
export const MIN_LOOP_THRESHOLD = 2;
export const MAX_LOOP_THRESHOLD = 5;
export const LOOP_SETTINGS_KEY = 'hypeable:loop:v1';

export type LoopSettings = {
  enabled: boolean;
  threshold: number;
};

export const DEFAULT_LOOP_SETTINGS: LoopSettings = {
  enabled: true,
  threshold: DEFAULT_LOOP_THRESHOLD,
};

export function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_LOOP_THRESHOLD;
  }

  return Math.min(MAX_LOOP_THRESHOLD, Math.max(MIN_LOOP_THRESHOLD, Math.round(value)));
}

export function normalizeLoopSettings(value: unknown): LoopSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_LOOP_SETTINGS };
  }

  const record = value as Record<string, unknown>;

  return {
    enabled: record.enabled !== false,
    threshold: clampThreshold(typeof record.threshold === 'number' ? record.threshold : DEFAULT_LOOP_THRESHOLD),
  };
}

export function readLoopSettings(raw: string | null | undefined): LoopSettings {
  if (!raw) {
    return { ...DEFAULT_LOOP_SETTINGS };
  }

  try {
    return normalizeLoopSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LOOP_SETTINGS };
  }
}
