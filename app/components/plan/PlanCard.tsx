/**
 * Plan Card: dark, lime accent. Features as checkboxes. Cost is a range.
 */
import { useStore } from '@nanostores/react';
import type { ReactNode } from 'react';
import { CostAmount } from '~/components/cost/CostAmount';
import { Button } from '~/components/ui/Button';
import { asPlainText, estimatePlanCost, type HypeablePlan } from '~/lib/plan';
import { costStore } from '~/lib/stores/cost';
import { addPlanFeatureLine, setPlanExtraFeature, setPlanTickedIds } from '~/lib/stores/plan';

export type PlanCardProps = {
  plan: HypeablePlan | null;
  intro: string;
  raw: string;
  error?: string;
  tickedIds: string[];
  extraFeature: string;
  retries: number;
  maxRetries: number;
  model: string;
  provider?: string;
  planningCall?: { promptTokens: number; completionTokens: number };
  onApprove: () => void;
  onApproveAnyway: () => void;
  onRetry: () => void;
  onAskChanges: () => void;
  onCancel: () => void;
};

export function PlanCard({
  plan,
  intro,
  raw,
  error,
  tickedIds,
  extraFeature,
  retries,
  maxRetries,
  model,
  provider,
  planningCall,
  onApprove,
  onApproveAnyway,
  onRetry,
  onAskChanges,
  onCancel,
}: PlanCardProps) {
  const costSnapshot = useStore(costStore);

  const estimate = plan
    ? estimatePlanCost({
        model,
        provider,
        customPrices: costSnapshot.customPrices,
        plan,
        history: Object.values(costSnapshot.messages),
        planningCall,
      })
    : null;

  const ticked = new Set(tickedIds);

  return (
    <section
      role="region"
      aria-label="Build plan"
      data-contain="card"
      className="min-w-0 overflow-hidden rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface p-4 text-hype-text shadow-[var(--hype-shadow-md)]"
    >
      {plan ? (
        <>
          <h2 className="text-base font-semibold text-hype-text">{asPlainText(plan.title)}</h2>
          <p className="mt-1 text-sm text-hype-muted">{asPlainText(plan.summary)}</p>
          {intro ? <p className="mt-2 text-xs text-hype-muted">{asPlainText(intro)}</p> : null}

          <PlanList label="Pages" items={plan.pages.map((page) => `${page.name}: ${page.purpose}`)} />
          <PlanList label="Data" items={plan.data.map((row) => `${row.entity} (${row.storage})`)} />

          <div className="mt-3">
            <h3 className="text-xs font-medium uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">
              Features
            </h3>
            <ul className="mt-1 space-y-1">
              {plan.features.map((feature) => (
                <li key={feature.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ticked.has(feature.id)}
                      onChange={(event) => {
                        const next = new Set(tickedIds);

                        if (event.target.checked) {
                          next.add(feature.id);
                        } else {
                          next.delete(feature.id);
                        }

                        setPlanTickedIds([...next]);
                      }}
                      className="h-4 w-4 accent-[var(--hype-accent)]"
                    />
                    <span>
                      {asPlainText(feature.text)}
                      {feature.optional ? <span className="ml-1 text-xs text-hype-muted">optional</span> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addPlanFeatureLine();
              }}
            >
              <input
                aria-label="Add a feature"
                value={extraFeature}
                onChange={(event) => setPlanExtraFeature(event.target.value)}
                placeholder="Add a feature"
                className="flex-1 rounded-[var(--hype-radius-sm)] border border-hype-border bg-hype-bg px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-hype-ring"
              />
              <Button type="submit" variant="ghost" size="sm" className="h-auto px-2 py-1">
                Add
              </Button>
            </form>
          </div>

          <PlanList label="Stack" items={plan.stack} />
          <PlanList label="Assumptions" items={plan.assumptions} />
          <PlanList label="Risks" items={plan.risks} />

          {estimate ? <PlanEstimate estimate={estimate} /> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={onApprove}>Approve & build</PrimaryButton>
            <GhostButton onClick={onAskChanges}>Ask for changes</GhostButton>
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-base font-semibold text-hype-text">Plan could not be parsed</h2>
          {error ? <p className="mt-1 text-sm text-hype-muted">{asPlainText(error)}</p> : null}
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--hype-radius-sm)] bg-hype-bg p-2 text-xs text-hype-muted">
            {asPlainText(raw || intro)}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={onApproveAnyway}>Approve anyway</PrimaryButton>
            <GhostButton onClick={onRetry} disabled={retries >= maxRetries}>
              {retries > 0 ? `Retry (${retries}/${maxRetries})` : 'Retry'}
            </GhostButton>
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
          </div>
        </>
      )}
    </section>
  );
}

function PlanList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <h3 className="text-xs font-medium uppercase tracking-[var(--hype-tracking-label)] text-hype-muted">{label}</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-hype-muted">
        {items.map((item) => (
          <li key={item}>{asPlainText(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function PlanEstimate({ estimate }: { estimate: ReturnType<typeof estimatePlanCost> }) {
  if (estimate.unknown) {
    return (
      <p className="mt-3 min-w-0 text-sm text-hype-muted">
        Build cost <span className="font-medium text-hype-text">estimate</span>: price unknown. Set a price in Settings.
      </p>
    );
  }

  return (
    <p className="mt-3 min-w-0 text-sm text-hype-muted">
      Build cost <span className="font-medium text-hype-text">estimate</span>:{' '}
      <CostAmount dollars={estimate.low} verified={estimate.verified} digits={2} />
      {' – '}
      <CostAmount dollars={estimate.high} verified={estimate.verified} digits={2} />
      <span className="mt-1 block">
        planning call <CostAmount dollars={estimate.planningCall} verified={estimate.verified} digits={3} />
      </span>
    </p>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <Button type="button" variant="primary" onClick={onClick}>
      {children}
    </Button>
  );
}

function GhostButton({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button type="button" variant="ghost" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
