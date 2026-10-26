/**
 * Shared secret regex catalog. Same JSON as scripts/secret-scan.mjs.
 */
import catalog from '~/lib/security/secret-patterns.json';

export type SecretPattern = {
  id: string;
  label: string;
  regex: RegExp;
};

type CatalogPattern = {
  id: string;
  label: string;
  source: string;
  flags?: string;
};

const rows = (catalog as { patterns: CatalogPattern[] }).patterns;

export const SECRET_PATTERNS: SecretPattern[] = rows.map((row) => ({
  id: row.id,
  label: row.label,
  regex: new RegExp(row.source, `${row.flags ?? ''}g`),
}));

export function cloneSecretPatterns(): SecretPattern[] {
  return SECRET_PATTERNS.map((row) => ({
    id: row.id,
    label: row.label,
    regex: new RegExp(row.regex.source, row.regex.flags),
  }));
}
