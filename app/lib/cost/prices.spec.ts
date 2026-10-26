import { describe, expect, it } from 'vitest';
import { getPricesCatalog } from './calc';

const URL_RE = /^https?:\/\//i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe('prices catalog', () => {
  it('requires every verified row to name an official source URL and checkedAt date', () => {
    const missing: string[] = [];

    for (const provider of getPricesCatalog().providers) {
      for (const row of provider.models) {
        if (!row.verified) {
          continue;
        }

        const source = row.source ?? provider.source;
        const checkedAt = row.checkedAt ?? getPricesCatalog().checkedAt;

        if (!source || !URL_RE.test(source)) {
          missing.push(`${provider.id}:${row.pattern} missing source URL`);
        }

        if (!checkedAt || !DATE_RE.test(checkedAt)) {
          missing.push(`${provider.id}:${row.pattern} missing checkedAt`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('stores source and checkedAt on every catalog row', () => {
    const missing: string[] = [];

    for (const provider of getPricesCatalog().providers) {
      for (const row of provider.models) {
        if (!row.source || !URL_RE.test(row.source)) {
          missing.push(`${provider.id}:${row.pattern} missing per-entry source`);
        }

        if (!row.checkedAt || !DATE_RE.test(row.checkedAt)) {
          missing.push(`${provider.id}:${row.pattern} missing per-entry checkedAt`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
