/**
 * Collapsible approved-plan panel for the chat header.
 */
import { useStore } from '@nanostores/react';
import { asPlainText } from '~/lib/plan';
import { planStore, setPlanPanelOpen } from '~/lib/stores/plan';

export function PlanPanel() {
  const state = useStore(planStore);
  const plan = state.approved;

  if (!plan) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-expanded={state.panelOpen}
        onClick={() => setPlanPanelOpen(!state.panelOpen)}
        className="rounded-[var(--hype-radius-sm)] border border-hype-border bg-hype-surface px-2 py-0.5 text-xs font-medium text-hype-accent-text hover:bg-hype-surface-2"
      >
        Plan
      </button>
      {state.panelOpen ? (
        <div className="max-w-xs truncate text-xs text-bolt-elements-textSecondary" title={asPlainText(plan.summary)}>
          {asPlainText(plan.title)}
        </div>
      ) : null}
    </div>
  );
}
