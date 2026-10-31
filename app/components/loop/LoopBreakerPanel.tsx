/**
 * Recovery panel shown when the same error (or identical write) repeats.
 * Dark, lime accent, not scary — the point is to stop the bleed, not panic.
 */
import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { TextLink } from '~/components/ui/TextLink';
import { formatDollars } from '~/lib/cost/calc';
import { stripStackTrace } from '~/lib/errors/user-facing';

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
  const lines = stripStackTrace(displayError).split('\n');
  const truncated = lines.length > PREVIEW_LINES;
  const cleaned = lines.join('\n');
  const shown = expanded || !truncated ? cleaned : lines.slice(0, PREVIEW_LINES).join('\n');

  return (
    <section
      role="status"
      aria-label="Same error, looping"
      aria-live="polite"
      className="rounded-[var(--hype-radius-lg)] border border-hype-border bg-hype-surface p-4 shadow-[var(--hype-shadow-md)]"
    >
      <div className="flex items-start gap-3">
        <div className="i-ph:repeat-once text-xl text-hype-warn" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-hype-text">Same error, looping</h2>
          <p className="mt-1 text-sm text-hype-muted">
            Failed {count} times. This loop cost you {formatDollars(wastedCost, 3)}.
          </p>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--hype-radius-sm)] bg-hype-bg p-2 text-xs text-hype-muted">
            {shown}
          </pre>
          {truncated && (
            <TextLink className="mt-1 text-[11px]" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show less' : 'Show more'}
            </TextLink>
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
    <Button type="button" variant={primary ? 'primary' : 'ghost'} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
