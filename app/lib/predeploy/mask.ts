/**
 * Mask secrets so findings, the store, and the DOM never hold a full value.
 * Always first 4 characters plus ***.
 */

export function maskSecret(value: string): string {
  if (value.length <= 4) {
    return '****';
  }

  return `${value.slice(0, 4)}***`;
}

export function maskSnippet(line: string, matches: readonly string[]): string {
  let snippet = line.replace(/\s+/g, ' ').trim();

  const unique = [...new Set(matches.filter(Boolean))].sort((a, b) => b.length - a.length);

  for (const match of unique) {
    snippet = snippet.split(match).join(maskSecret(match));
  }

  if (snippet.length > 160) {
    return `${snippet.slice(0, 157)}...`;
  }

  return snippet;
}

export function findingHoldsSecret(finding: object, secret: string): boolean {
  return JSON.stringify(finding).includes(secret);
}
