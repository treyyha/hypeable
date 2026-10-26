/**
 * Spend dashboard. Reads the cost store and local ledger only.
 * Layout adapted from kokonutUI dashboard lists (MIT, (c) 2025 kokonutUI).
 */
import { useState } from 'react';
import { toast } from 'react-toastify';
import { CostAmount } from '~/components/cost/CostAmount';
import { ActionButton, ActionRow } from '~/components/ui/ActionRow';
import { EmptyState } from '~/components/ui/EmptyState';
import { ListPanel, ListRow, RowAvatar } from '~/components/ui/ListRow';
import { ProgressCard } from '~/components/ui/ProgressCard';
import { StatCard } from '~/components/ui/StatCard';
import { formatTokenCount } from '~/lib/cost/calc';
import {
  aggregateByModel,
  capProgress,
  ledgerToCsv,
  monthToDateTotal,
  type LedgerEntry,
  type ModelSpendRow,
} from '~/lib/cost/ledger';
import type { CostSnapshot } from '~/lib/cost/persist';
import { formatReceipt } from '~/lib/cost/receipt';

const PREVIEW_BUILDS = 6;

function openCostSettings() {
  document.dispatchEvent(new CustomEvent('open-hypeable-settings', { detail: { tab: 'settings' } }));
}

function modelRows(entries: LedgerEntry[], snapshot: CostSnapshot): ModelSpendRow[] {
  if (entries.length > 0) {
    return aggregateByModel(entries);
  }

  const total = Object.values(snapshot.byModel).reduce((sum, row) => sum + row.dollars, 0);

  return Object.entries(snapshot.byModel)
    .map(([model, row]) => ({
      model,
      dollars: row.dollars,
      tokens: row.promptTokens + row.completionTokens,
      share: total > 0 ? row.dollars / total : 0,
      unverified: Boolean(row.unverified),
    }))
    .sort((a, b) => b.dollars - a.dollars || a.model.localeCompare(b.model));
}

function toneFor(index: number): 'lime' | 'mint' | 'cyan' {
  return index % 3 === 0 ? 'lime' : index % 3 === 1 ? 'mint' : 'cyan';
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadCsv(entries: LedgerEntry[]) {
  const csv = ledgerToCsv(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hypeable-spend.csv';
  link.click();
  URL.revokeObjectURL(url);
}

type SpendViewProps = {
  snapshot: CostSnapshot;
  entries: LedgerEntry[];
  now?: Date;
};

export function SpendView({ snapshot, entries, now = new Date() }: SpendViewProps) {
  const [expanded, setExpanded] = useState(false);
  const empty = snapshot.sessionTotal === 0 && snapshot.dailyTotal === 0 && entries.length === 0;
  const models = modelRows(entries, snapshot);
  const visibleBuilds = expanded ? entries : entries.slice(0, PREVIEW_BUILDS);
  const mtd = Math.max(monthToDateTotal(entries, now), snapshot.dailyTotal);
  const sessionCap = capProgress(snapshot.sessionTotal, snapshot.caps.session);
  const dailyCap = capProgress(snapshot.dailyTotal, snapshot.caps.daily);

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(formatReceipt(snapshot));
      toast.success('Receipt copied');
    } catch {
      toast.error('Could not copy receipt');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6" data-testid="spend-page">
      <StatCard
        label="Spent today"
        value={<CostAmount dollars={snapshot.dailyTotal} digits={2} className="text-3xl sm:text-4xl" />}
        footer={
          <ActionRow columns={3} className="w-full">
            <ActionButton icon="i-ph:sliders-horizontal" onClick={openCostSettings}>
              Set caps
            </ActionButton>
            <ActionButton icon="i-ph:copy" onClick={() => void copyReceipt()}>
              Copy receipt
            </ActionButton>
            <ActionButton
              icon="i-ph:download-simple"
              onClick={() => downloadCsv(entries)}
              disabled={entries.length === 0}
            >
              Export CSV
            </ActionButton>
          </ActionRow>
        }
      >
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-hype-muted">
          <span>
            Session{' '}
            <span className="tabular-nums text-hype-text">
              <CostAmount dollars={snapshot.sessionTotal} digits={3} />
            </span>
          </span>
          <span>
            Month-to-date{' '}
            <span className="tabular-nums text-hype-text">
              <CostAmount dollars={mtd} digits={2} />
            </span>
          </span>
        </div>
      </StatCard>

      {empty ? (
        <EmptyState icon="i-ph:receipt" title="Nothing spent yet" description="Your first build will show up here." />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListPanel
          title="Models"
          extra={models.length > 0 ? `${models.length}` : undefined}
          empty={
            models.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-hype-muted">
                Nothing spent yet. Your first build will show up here.
              </p>
            ) : undefined
          }
        >
          {models.map((row, index) => (
            <ListRow
              key={row.model}
              leading={<RowAvatar label={row.provider || row.model} tone={toneFor(index)} />}
              title={row.model}
              subtitle={row.provider}
              trailing={
                <div>
                  <div className="text-xs font-medium tabular-nums text-hype-text">
                    <CostAmount dollars={row.dollars} verified={!row.unverified} digits={3} />
                  </div>
                  <div className="text-[11px] tabular-nums text-hype-muted">
                    {Math.round(row.share * 100)}% · {formatTokenCount(row.tokens)}
                  </div>
                </div>
              }
            />
          ))}
        </ListPanel>

        <ListPanel
          title="Recent builds"
          extra={entries.length > 0 ? `${entries.length}` : undefined}
          empty={
            entries.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-hype-muted">
                Nothing spent yet. Your first build will show up here.
              </p>
            ) : undefined
          }
          footer={
            entries.length > PREVIEW_BUILDS ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-[var(--hype-radius-md)] py-2 text-xs font-medium text-hype-muted hover:bg-hype-surface-2 hover:text-hype-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? 'Show less' : 'View all'}
                <span className={expanded ? 'i-ph:caret-up' : 'i-ph:caret-down'} />
              </button>
            ) : undefined
          }
        >
          {visibleBuilds.map((row) => (
            <ListRow
              key={row.id}
              leading={<RowAvatar label={row.model} tone="cyan" />}
              title={row.chatName || 'Untitled build'}
              subtitle={`${formatWhen(row.timestamp)} · ${row.model} · ${formatTokenCount(row.promptTokens + row.completionTokens)}`}
              trailing={
                <span className="text-xs font-medium tabular-nums text-hype-text">
                  <CostAmount dollars={row.dollars} verified={row.verified !== false} digits={3} />
                </span>
              }
            />
          ))}
        </ListPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProgressCard
          title="Session cap"
          subtitle={sessionCap.off ? 'Off' : undefined}
          value={sessionCap.ratio}
          status={sessionCap.level}
          amount={
            <>
              <CostAmount dollars={snapshot.sessionTotal} digits={3} />
              {sessionCap.off ? (
                ' · off'
              ) : (
                <>
                  {' '}
                  / <CostAmount dollars={snapshot.caps.session} digits={2} />
                </>
              )}
            </>
          }
        />
        <ProgressCard
          title="Daily cap"
          subtitle={dailyCap.off ? 'Off' : undefined}
          value={dailyCap.ratio}
          status={dailyCap.level}
          amount={
            <>
              <CostAmount dollars={snapshot.dailyTotal} digits={3} />
              {dailyCap.off ? (
                ' · off'
              ) : (
                <>
                  {' '}
                  / <CostAmount dollars={snapshot.caps.daily} digits={2} />
                </>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
