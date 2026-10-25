/**
 * Shareable one-liner for a session. Uses real totals, not placeholders.
 */
import { formatDollars, formatTokenCount } from './calc';
import type { CostSnapshot } from './persist';

export const RECEIPT_HOST = 'hypeable.dev';

export function formatReceipt(
  snapshot: Pick<CostSnapshot, 'sessionTotal' | 'sessionPromptTokens' | 'sessionCompletionTokens' | 'byModel'>,
): string {
  const tokens = snapshot.sessionPromptTokens + snapshot.sessionCompletionTokens;

  const models = Object.keys(snapshot.byModel)
    .filter((model) => model && model !== 'unknown')
    .sort((a, b) => snapshot.byModel[b].dollars - snapshot.byModel[a].dollars || a.localeCompare(b));

  const modelList = models.length > 0 ? models.join(', ') : 'no model';

  return `Built with Hypeable: ${formatDollars(snapshot.sessionTotal, 2)} | ${formatTokenCount(tokens)} tokens | ${modelList} | ${RECEIPT_HOST}`;
}
