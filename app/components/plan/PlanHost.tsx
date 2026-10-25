/**
 * Renders the pending Plan Card and wires approve / retry / changes / cancel.
 */
import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { PlanCard } from './PlanCard';
import { MAX_PLAN_RETRIES, buildApprovedPlanMessage, planWithTickedFeatures, type HypeablePlan } from '~/lib/plan';
import {
  addPlanFeatureLine,
  approvePendingPlan,
  cancelPendingPlan,
  incrementPlanRetry,
  planStore,
} from '~/lib/stores/plan';

export function PlanHost({
  sendMessage,
  model,
  provider,
}: {
  sendMessage: (text: string) => void;
  model: string;
  provider?: string;
}) {
  const state = useStore(planStore);
  const [askOpen, setAskOpen] = useState(false);
  const [changes, setChanges] = useState('');
  const pending = state.pending;

  if (!pending) {
    return null;
  }

  const approvePlan = (plan: HypeablePlan) => {
    const extra = pending.extraFeature.trim();

    if (extra) {
      addPlanFeatureLine();
    }

    const latest = planStore.get().pending;
    const ticked = latest?.tickedIds ?? pending.tickedIds;
    const source = latest?.plan ?? plan;
    const approved = planWithTickedFeatures(source, ticked);
    approvePendingPlan(approved);
    sendMessage(buildApprovedPlanMessage(approved, ticked));
  };

  return (
    <div className="flex flex-col gap-2">
      <PlanCard
        plan={pending.plan}
        intro={pending.intro}
        raw={pending.raw}
        error={pending.error}
        tickedIds={pending.tickedIds}
        extraFeature={pending.extraFeature}
        retries={pending.retries}
        maxRetries={MAX_PLAN_RETRIES}
        model={model}
        provider={provider}
        onApprove={() => {
          if (pending.plan) {
            approvePlan(pending.plan);
          }
        }}
        onApproveAnyway={() => {
          const fallback: HypeablePlan = pending.plan ?? {
            title: 'Approved plan',
            summary: pending.raw || pending.intro || 'Build the requested app.',
            pages: [],
            data: [],
            features: [],
            stack: [],
            assumptions: [],
            risks: [],
          };
          approvePlan(fallback);
        }}
        onRetry={() => {
          if (!incrementPlanRetry()) {
            return;
          }

          const prompt = planStore.get().lastUserPrompt;
          cancelPendingPlan();
          planStore.set({ ...planStore.get(), forceNextTurn: true });
          sendMessage(prompt);
        }}
        onAskChanges={() => setAskOpen(true)}
        onCancel={cancelPendingPlan}
      />
      {askOpen ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            const text = changes.trim();

            if (!text) {
              return;
            }

            cancelPendingPlan();
            planStore.set({ ...planStore.get(), forceNextTurn: true });
            sendMessage(`Please revise the plan:\n${text}`);
            setAskOpen(false);
            setChanges('');
          }}
        >
          <input
            aria-label="Ask for plan changes"
            value={changes}
            onChange={(event) => setChanges(event.target.value)}
            placeholder="What should change?"
            className="flex-1 rounded-md border border-[#302e39] bg-[#121116] px-2 py-1 text-sm text-[#f4f1fa] outline-none focus:border-lime-400"
          />
          <button type="submit" className="rounded-md bg-lime-400 px-3 py-1.5 text-sm font-medium text-gray-950">
            Replan
          </button>
        </form>
      ) : null}
    </div>
  );
}
