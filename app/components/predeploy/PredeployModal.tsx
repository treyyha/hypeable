/**
 * Pre-deploy security report. Masked findings only; no network.
 */
import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Badge } from '~/components/ui/Badge';
import { Dialog, DialogButton, DialogDescription, DialogTitle } from '~/components/ui/Dialog';
import { publishActionEnabled, publishActionLabel, showRiskCheckbox } from '~/lib/predeploy/gating';
import { fixWithAiPrompt, reportToMarkdown } from '~/lib/predeploy/report';
import type { Finding, ScanOutcome } from '~/lib/predeploy/types';
import { closePredeploy, predeployUiStore, setPredeployAcknowledged } from '~/lib/stores/predeploy';

const SEND_EVENT = 'hypeable-send-chat';

function sendFixPrompt(markdown: string): void {
  document.dispatchEvent(new CustomEvent(SEND_EVENT, { detail: { message: markdown } }));
}

function outcomeCopy(outcome: ScanOutcome): { title: string; body: string } {
  if (outcome === 'pass') {
    return {
      title: 'Ready to publish',
      body: 'No blocking issues. You can continue to your host.',
    };
  }

  if (outcome === 'warn') {
    return {
      title: 'Warnings before publish',
      body: 'Nothing failed, but these are worth fixing. Publish anyway only if you have checked them.',
    };
  }

  return {
    title: 'Publish blocked',
    body: 'Fix the failures, or confirm you understand the risk before publishing anyway.',
  };
}

export function PredeployModal() {
  const state = useStore(predeployUiStore);
  const [copying, setCopying] = useState(false);

  if (!state.open || !state.report) {
    return null;
  }

  const report = state.report;
  const copy = outcomeCopy(report.outcome);
  const continueEnabled = publishActionEnabled(report.outcome, state.acknowledged);
  const continueLabel = publishActionLabel(report.outcome);

  const grouped: Array<{ label: string; items: Finding[] }> = [
    { label: 'Failures', items: report.findings.filter((item) => !item.suppressed && item.severity === 'FAIL') },
    { label: 'Warnings', items: report.findings.filter((item) => !item.suppressed && item.severity === 'WARN') },
    { label: 'Info', items: report.findings.filter((item) => !item.suppressed && item.severity === 'INFO') },
    { label: 'Suppressed', items: report.findings.filter((item) => item.suppressed) },
  ];

  const copyReport = async () => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(reportToMarkdown(report));
      toast.success('Report copied');
    } catch {
      toast.error('Could not copy report');
    } finally {
      setCopying(false);
    }
  };

  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          closePredeploy(false);
        }
      }}
    >
      <Dialog
        className="flex max-h-[min(40rem,calc(100vh-3rem))] w-[min(40rem,calc(100vw-1.5rem))] flex-col overflow-hidden"
        onClose={() => closePredeploy(false)}
        onBackdrop={() => closePredeploy(false)}
      >
        <div className="border-b border-hype-border p-6 pb-4">
          <DialogTitle className={report.outcome === 'fail' ? 'text-hype-danger' : 'text-hype-text'}>
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="predeploy-summary">
            <Badge variant={report.counts.fail ? 'danger' : 'subtle'} size="sm">
              {report.counts.fail} fail
            </Badge>
            <Badge variant={report.counts.warn ? 'warning' : 'subtle'} size="sm">
              {report.counts.warn} warn
            </Badge>
            <Badge variant="subtle" size="sm">
              {report.counts.info} info
            </Badge>
            {report.counts.suppressed > 0 ? (
              <Badge variant="subtle" size="sm">
                {report.counts.suppressed} suppressed
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" data-testid="predeploy-findings">
          {report.outcome === 'pass' && report.counts.fail === 0 && report.counts.warn === 0 ? (
            <div className="rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-surface-2 p-4 text-sm text-hype-text">
              Scan is clean. Publish when you are ready.
            </div>
          ) : null}

          {grouped.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.label} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-hype-muted">{group.label}</h3>
                <ul className="space-y-2">
                  {group.items.map((finding, index) => (
                    <FindingRow key={`${finding.ruleId}:${finding.file}:${finding.line}:${index}`} finding={finding} />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>

        <div className="space-y-3 border-t border-hype-border p-6 pt-4">
          {showRiskCheckbox(report.outcome) ? (
            <label className="flex items-start gap-2 text-sm text-hype-text">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-hype-border accent-hype-danger"
                checked={state.acknowledged}
                onChange={(event) => setPredeployAcknowledged(event.target.checked)}
                data-testid="predeploy-risk"
              />
              I understand the risk
            </label>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogButton type="secondary" onClick={() => void copyReport()} disabled={copying}>
              Copy report (markdown)
            </DialogButton>
            <DialogButton
              type="secondary"
              onClick={() => {
                sendFixPrompt(fixWithAiPrompt(report));
                closePredeploy(false);
                toast.success('Sent findings to chat');
              }}
            >
              Fix with AI
            </DialogButton>
            <DialogButton type="secondary" onClick={() => closePredeploy(false)}>
              Cancel
            </DialogButton>
            <DialogButton type="primary" disabled={!continueEnabled} onClick={() => closePredeploy(true)}>
              {continueLabel}
            </DialogButton>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="rounded-[var(--hype-radius-md)] border border-hype-border bg-hype-bg p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-hype-text">
          {finding.file}:{finding.line}
        </span>
        <Badge
          variant={finding.severity === 'FAIL' ? 'danger' : finding.severity === 'WARN' ? 'warning' : 'info'}
          size="sm"
        >
          {finding.ruleId}
        </Badge>
        {finding.heuristic ? (
          <Badge variant="subtle" size="sm">
            heuristic, verify
          </Badge>
        ) : null}
        {finding.suppressed ? (
          <Badge variant="subtle" size="sm">
            suppressed
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-hype-text">{finding.why}</p>
      <p className="mt-1 font-mono text-[11px] text-hype-muted">{finding.maskedSnippet}</p>
      <p className="mt-1 text-xs text-hype-muted">Fix: {finding.fix}</p>
    </li>
  );
}
