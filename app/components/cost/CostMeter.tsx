import { useStore } from '@nanostores/react';
import * as Popover from '@radix-ui/react-popover';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { CapReachedModal } from './CapReachedModal';
import { CostAmount } from './CostAmount';
import { formatDollars, formatPricesCheckedAt, formatTokenCount, getPricesCatalog } from '~/lib/cost/calc';
import { capLevel } from '~/lib/cost/caps';
import { formatReceipt } from '~/lib/cost/receipt';
import { costStore, costToastStore, startNewSession } from '~/lib/stores/cost';
import { classNames } from '~/utils/classNames';

function openCostSettings() {
  document.dispatchEvent(new CustomEvent('open-hypeable-settings', { detail: { tab: 'settings' } }));
}

function pillTone(
  sessionSpent: number,
  dailySpent: number,
  sessionCap: number,
  dailyCap: number,
): 'ok' | 'warn' | 'hit' {
  const session = capLevel(sessionSpent, sessionCap);
  const daily = capLevel(dailySpent, dailyCap);

  if (session === 'hit' || daily === 'hit') {
    return 'hit';
  }

  if (session === 'warn' || daily === 'warn') {
    return 'warn';
  }

  return 'ok';
}

function CapBar({ label, spent, cap }: { label: string; spent: number; cap: number }) {
  const off = !(cap > 0);
  const ratio = off ? 0 : Math.min(100, (spent / cap) * 100);
  const level = capLevel(spent, cap);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-bolt-elements-textSecondary">{label}</span>
        <span className="tabular-nums text-bolt-elements-textPrimary">
          {formatDollars(spent, 3)}
          {off ? ' · off' : ` / ${formatDollars(cap, 2)}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bolt-elements-background-depth-3">
        <div
          className={classNames('h-full rounded-full transition-[width,background-color] duration-300', {
            'bg-accent-500': level === 'ok',
            'bg-orange-400': level === 'warn',
            'bg-red-500': level === 'hit',
          })}
          style={{ width: off ? '0%' : `${ratio}%` }}
        />
      </div>
    </div>
  );
}

export function CostMeter() {
  const snapshot = useStore(costStore);
  const toastKind = useStore(costToastStore);
  const [ticking, setTicking] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const previousTotal = useRef(snapshot.sessionTotal);
  const liveMessage = useRef('');

  useEffect(() => {
    if (previousTotal.current === snapshot.sessionTotal) {
      return undefined;
    }

    previousTotal.current = snapshot.sessionTotal;
    setTicking(true);

    const timer = window.setTimeout(() => setTicking(false), 280);

    return () => window.clearTimeout(timer);
  }, [snapshot.sessionTotal]);

  useEffect(() => {
    if (!toastKind) {
      return;
    }

    const cap = snapshot.caps[toastKind];
    const spent = toastKind === 'daily' ? snapshot.dailyTotal : snapshot.sessionTotal;
    toast.warning(
      `${toastKind === 'daily' ? 'Daily' : 'Session'} cap at 80%: ${formatDollars(spent, 2)} of ${formatDollars(cap, 2)}`,
      {
        toastId: `hypeable-cost-80-${toastKind}`,
      },
    );
    costToastStore.set(null);
  }, [toastKind, snapshot.caps, snapshot.dailyTotal, snapshot.sessionTotal]);

  const tone = pillTone(snapshot.sessionTotal, snapshot.dailyTotal, snapshot.caps.session, snapshot.caps.daily);
  const models = Object.entries(snapshot.byModel).sort((a, b) => b[1].dollars - a[1].dollars);
  const unknownModels = models.filter(([, row]) => row.unknown);
  const unverifiedSpend = models.some(([, row]) => row.unverified);
  const pricesChecked = formatPricesCheckedAt(getPricesCatalog().checkedAt);

  useEffect(() => {
    const next =
      tone === 'hit'
        ? `Spending cap reached at ${formatDollars(snapshot.sessionTotal, 2)}`
        : tone === 'warn'
          ? `Spending at 80 percent of cap, ${formatDollars(snapshot.sessionTotal, 2)}`
          : '';

    if (next !== liveMessage.current) {
      liveMessage.current = next;
      setAnnouncement(next);
    }
  }, [tone, snapshot.sessionTotal]);

  const copyReceipt = async () => {
    const text = formatReceipt(snapshot);

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Receipt copied', { toastId: 'hypeable-cost-receipt' });
    } catch {
      toast.error('Could not copy receipt');
    }
  };

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={classNames(
              'group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold tabular-nums tracking-tight',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60',
              {
                'border-accent-500/30 bg-accent-500/10 text-accent-300 hover:border-accent-500/60': tone === 'ok',
                'border-orange-400/40 bg-orange-400/10 text-orange-300 hover:border-orange-400/70': tone === 'warn',
                'border-red-500/50 bg-red-500/10 text-red-400 hover:border-red-500/80': tone === 'hit',
                'cost-meter-tick': ticking,
              },
            )}
            aria-label={`Session spend ${unverifiedSpend ? 'about ' : ''}${formatDollars(snapshot.sessionTotal, 3)}${unverifiedSpend ? ', price unverified' : ''}`}
          >
            <span className="i-ph:coins text-[14px] opacity-80" />
            <CostAmount dollars={snapshot.sessionTotal} verified={!unverifiedSpend} digits={3} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            className="z-[9999] w-[320px] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-3.5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-bolt-elements-textTertiary">Spend</p>
                <p className="mt-0.5 text-lg font-semibold text-bolt-elements-textPrimary">
                  <CostAmount dollars={snapshot.sessionTotal} verified={!unverifiedSpend} digits={3} />
                </p>
                <p className="mt-1 text-[11px] text-bolt-elements-textTertiary">{pricesChecked}</p>
              </div>
              <button
                type="button"
                onClick={copyReceipt}
                className="rounded-md border border-bolt-elements-borderColor px-2 py-1 text-[11px] text-bolt-elements-textSecondary hover:border-accent-500/50 hover:text-accent-300"
              >
                Copy receipt
              </button>
            </div>

            <div className="space-y-3">
              <CapBar label="Session" spent={snapshot.sessionTotal} cap={snapshot.caps.session} />
              <CapBar label="Today" spent={snapshot.dailyTotal} cap={snapshot.caps.daily} />
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-bolt-elements-textTertiary">
                By model
              </p>
              {models.length === 0 ? (
                <p className="text-xs text-bolt-elements-textSecondary">Nothing billed this session.</p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {models.map(([model, row]) => (
                    <li key={model} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate text-bolt-elements-textSecondary" title={model}>
                        {model}
                      </span>
                      <span className="shrink-0 text-bolt-elements-textPrimary">
                        {row.unknown ? (
                          'price unknown'
                        ) : (
                          <CostAmount dollars={row.dollars} verified={!row.unverified} digits={3} />
                        )}
                        <span className="ml-1 tabular-nums text-bolt-elements-textTertiary">
                          {formatTokenCount(row.promptTokens + row.completionTokens)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {unknownModels.length > 0 && (
                <button
                  type="button"
                  onClick={openCostSettings}
                  className="mt-2 text-left text-[11px] text-accent-300 hover:underline"
                >
                  Price unknown, set it in settings
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-bolt-elements-borderColor pt-3">
              <button
                type="button"
                onClick={startNewSession}
                className="text-[11px] text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                Start new session
              </button>
              <button type="button" onClick={openCostSettings} className="text-[11px] text-accent-300 hover:underline">
                Caps &amp; prices
              </button>
            </div>
            <Popover.Arrow className="fill-bolt-elements-background-depth-2" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <CapReachedModal />
    </>
  );
}
