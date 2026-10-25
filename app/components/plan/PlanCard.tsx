/**
 * Plan Card: dark, lime accent. Features as checkboxes. Cost is a range.
 */
import { useStore } from '@nanostores/react';
import type { ReactNode } from 'react';
import { CostAmount } from '~/components/cost/CostAmount';
import { asPlainText, estimatePlanCost, type HypeablePlan } from '~/lib/plan';
import { costStore } from '~/lib/stores/cost';
import { addPlanFeatureLine, setPlanExtraFeature, setPlanTickedIds } from '~/lib/stores/plan';
import { classNames } from '~/utils/classNames';

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
      className="rounded-xl border border-lime-400/35 bg-[#1b1a22] p-4 text-[#f4f1fa] shadow-lg"
    >
      {plan ? (
        <>
          <h2 className="text-base font-semibold text-lime-300">{asPlainText(plan.title)}</h2>
          <p className="mt-1 text-sm text-[#c9c4d4]">{asPlainText(plan.summary)}</p>
          {intro ? <p className="mt-2 text-xs text-[#a09baa]">{asPlainText(intro)}</p> : null}

          <PlanList label="Pages" items={plan.pages.map((page) => `${page.name}: ${page.purpose}`)} />
          <PlanList label="Data" items={plan.data.map((row) => `${row.entity} (${row.storage})`)} />

          <div className="mt-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[#a09baa]">Features</h3>
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
                      className="h-4 w-4 accent-[#C8FF3D]"
                    />
                    <span>
                      {asPlainText(feature.text)}
                      {feature.optional ? <span className="ml-1 text-xs text-[#a09baa]">optional</span> : null}
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
                className="flex-1 rounded-md border border-[#302e39] bg-[#121116] px-2 py-1 text-sm outline-none focus:border-lime-400"
              />
              <button
                type="submit"
                className="rounded-md border border-[#393641] px-2 py-1 text-xs text-[#c9c4d4] hover:border-lime-400/50"
              >
                Add
              </button>
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
          <h2 className="text-base font-semibold text-lime-300">Plan could not be parsed</h2>
          {error ? <p className="mt-1 text-sm text-[#c9c4d4]">{asPlainText(error)}</p> : null}
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-[#121116] p-2 text-xs text-[#c9c4d4]">
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
      <h3 className="text-xs font-medium uppercase tracking-wide text-[#a09baa]">{label}</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-[#c9c4d4]">
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
      <p className="mt-3 text-sm text-[#a09baa]">
        Build cost <span className="font-medium text-[#f4f1fa]">estimate</span>: price unknown. Set a price in Settings.
      </p>
    );
  }

  return (
    <p className="mt-3 text-sm text-[#a09baa]">
      Build cost <span className="font-medium text-[#f4f1fa]">estimate</span>:{' '}
      <CostAmount dollars={estimate.low} verified={estimate.verified} digits={2} />
      {' – '}
      <CostAmount dollars={estimate.high} verified={estimate.verified} digits={2} />
      <span className="ml-2">
        planning call <CostAmount dollars={estimate.planningCall} verified={estimate.verified} digits={3} />
      </span>
    </p>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-lime-400 px-3 py-1.5 text-sm font-medium text-gray-950 hover:bg-lime-300"
    >
      {children}
    </button>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'rounded-md border border-[#393641] bg-[#302e39] px-3 py-1.5 text-sm text-[#eeeaf5] hover:border-lime-400/50',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      )}
    >
      {children}
    </button>
  );
}
