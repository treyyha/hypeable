import { useStore } from '@nanostores/react';
import { CostAmount } from './CostAmount';
import { cost, formatTokenCount } from '~/lib/cost/calc';
import { extractTokenUsage } from '~/lib/cost/usage';
import { costStore } from '~/lib/stores/cost';

function openCostSettings() {
  document.dispatchEvent(new CustomEvent('open-hypeable-settings', { detail: { tab: 'settings' } }));
}

export function MessageCost({
  messageId,
  model,
  provider,
  usage,
}: {
  messageId?: string;
  model?: string;
  provider?: string;
  usage: unknown;
}) {
  const snapshot = useStore(costStore);
  const stored = messageId ? (snapshot.messages[messageId] ?? snapshot.messages[`pending:${messageId}`]) : undefined;
  const tokens = extractTokenUsage(usage);

  const result =
    stored ??
    (tokens
      ? cost(model ?? 'unknown', tokens.promptTokens, tokens.completionTokens, {
          cachedTokens: tokens.cachedTokens,
          actualCost: tokens.cost,
          customPrices: snapshot.customPrices,
          provider,
        })
      : undefined);

  if (!result && !tokens) {
    return null;
  }

  const unknown = result ? result.unknown : true;
  const dollars = result && !result.unknown ? result.dollars : 0;
  const verified = result && !result.unknown ? result.verified !== false : true;

  const approximate =
    (result && 'approximate' in result && result.approximate) ||
    stored?.approximate === true ||
    stored?.precision === 'estimate';

  const prompt = stored?.promptTokens ?? tokens?.promptTokens ?? 0;
  const completion = stored?.completionTokens ?? tokens?.completionTokens ?? 0;
  const total = prompt + completion;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-bolt-elements-textTertiary">
      {unknown ? (
        <span className="tabular-nums">price unknown</span>
      ) : (
        <CostAmount
          dollars={dollars}
          verified={verified}
          approximate={approximate}
          digits={3}
          className="text-accent-400/90"
        />
      )}
      <span className="tabular-nums">
        {formatTokenCount(total)} tok
        <span className="text-bolt-elements-textTertiary/80">
          {' '}
          ({formatTokenCount(prompt)} in / {formatTokenCount(completion)} out)
        </span>
      </span>
      {unknown && (
        <button type="button" onClick={openCostSettings} className="text-accent-300 hover:underline">
          set it
        </button>
      )}
    </div>
  );
}
