/**
 * Recovery panel shown when the same error (or identical write) repeats.
 * Dark, lime accent, not scary — the point is to stop the bleed, not panic.
 */
import { useState } from 'react';
import { formatDollars } from '~/lib/cost/calc';
import { classNames } from '~/utils/classNames';

const PREVIEW_LINES = 4;

export type LoopBreakerPanelProps = {
  displayError: string;
  count: number;
  wastedCost: number;
  onReplan: () => void;
  onRevert: () => void;
  onSwitchModel: () => void;
  onKeepGoing: () => void;
  canRevert?: boolean;
};

export function LoopBreakerPanel({
  displayError,
  count,
  wastedCost,
  onReplan,
  onRevert,
  onSwitchModel,
  onKeepGoing,
  canRevert = true,
}: LoopBreakerPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = displayError.split('\n');
  const truncated = lines.length > PREVIEW_LINES;
  const shown = expanded || !truncated ? displayError : lines.slice(0, PREVIEW_LINES).join('\n');

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border border-lime-400/35 bg-bolt-elements-background-depth-2 p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="i-ph:repeat-once text-xl text-lime-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-bolt-elements-textPrimary">Same error, looping</h2>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            Failed {count} times. This loop cost you {formatDollars(wastedCost, 3)}.
          </p>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-bolt-elements-background-depth-3 p-2 text-xs text-bolt-elements-textSecondary">
            {shown}
          </pre>
          {truncated && (
            <button
              type="button"
              className="mt-1 text-[11px] text-lime-300 hover:underline"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <PanelButton onClick={onReplan} primary>
              Replan
            </PanelButton>
            <PanelButton onClick={onRevert} disabled={!canRevert}>
              Revert
            </PanelButton>
            <PanelButton onClick={onSwitchModel}>Switch model</PanelButton>
            <PanelButton onClick={onKeepGoing}>Keep going</PanelButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function PanelButton({
  onClick,
  children,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  children: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'rounded-md px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-lime-400/50',
        primary
          ? 'bg-lime-400 text-gray-950 hover:bg-lime-300'
          : 'border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary hover:border-lime-400/50',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      )}
    >
      {children}
    </button>
  );
}
