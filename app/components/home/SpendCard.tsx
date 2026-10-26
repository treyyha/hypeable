/**
 * Honest spend summary from the cost store. Zero is a real empty state.
 */
import { useStore } from '@nanostores/react';
import { CostAmount } from '~/components/cost/CostAmount';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Progress } from '~/components/ui/Progress';
import { capLevel } from '~/lib/cost/caps';
import { costStore } from '~/lib/stores/cost';
import { classNames } from '~/utils/classNames';

function CapRow({ label, spent, cap }: { label: string; spent: number; cap: number }) {
  const off = !(cap > 0);
  const ratio = off ? 0 : Math.min(100, (spent / cap) * 100);
  const level = capLevel(spent, cap);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">{label}</span>
        <span className="tabular-nums text-hype-text">
          <CostAmount dollars={spent} digits={3} />
          {off ? (
            ' · off'
          ) : (
            <>
              {' / '}
              <CostAmount dollars={cap} digits={2} />
            </>
          )}
        </span>
      </div>
      <Progress
        value={off ? 0 : ratio}
        className={classNames({
          '[&>div]:bg-hype-ok': level === 'ok',
          '[&>div]:bg-hype-warn': level === 'warn',
          '[&>div]:bg-hype-danger': level === 'hit',
        })}
      />
    </div>
  );
}

export function SpendCard() {
  const snapshot = useStore(costStore);
  const empty = snapshot.sessionTotal === 0 && snapshot.dailyTotal === 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">
          Your spend
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 p-4 pt-2">
        {empty ? (
          <p className="text-xs text-hype-muted">Nothing billed yet this session. Caps apply in this browser only.</p>
        ) : null}
        <CapRow label="Session" spent={snapshot.sessionTotal} cap={snapshot.caps.session} />
        <CapRow label="Today" spent={snapshot.dailyTotal} cap={snapshot.caps.daily} />
      </CardContent>
    </Card>
  );
}
