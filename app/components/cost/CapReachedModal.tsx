import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Dialog, DialogButton, DialogDescription, DialogTitle } from '~/components/ui/Dialog';
import { formatDollars } from '~/lib/cost/calc';
import {
  capDialogStore,
  dismissCapDialog,
  raiseCostCap,
  resumeAfterCapWarning,
  startNewSession,
} from '~/lib/stores/cost';

export function CapReachedModal() {
  const dialog = useStore(capDialogStore);

  if (!dialog) {
    return null;
  }

  const spentLabel = formatDollars(dialog.spent, 2);
  const capLabel = formatDollars(dialog.cap, 2);
  const isWouldCross = dialog.reason === 'would-cross';
  const kindLabel = dialog.kind === 'daily' ? 'daily' : 'session';

  return (
    <RadixDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) {
          dismissCapDialog();
        }
      }}
    >
      <Dialog onClose={dismissCapDialog} onBackdrop={dismissCapDialog}>
        <div className="p-6">
          <DialogTitle className="text-hype-danger">
            {isWouldCross ? 'This request would cross your cap' : `Cap reached: ${spentLabel} of ${capLabel}`}
          </DialogTitle>
          <DialogDescription>
            {isWouldCross
              ? `About ${formatDollars(dialog.estimate ?? 0, 3)} more would take this ${kindLabel} from ${spentLabel} over ${capLabel}.`
              : `You've hit the ${kindLabel} cap of ${capLabel}. Nothing else will be sent until you raise it or start a new session.`}
            {dialog.kind === 'daily' && !isWouldCross ? ' A new session does not reset the daily total.' : ''}
          </DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogButton type="secondary" onClick={dismissCapDialog}>
              {isWouldCross ? 'Cancel' : 'Close'}
            </DialogButton>
            {isWouldCross && (
              <DialogButton type="secondary" onClick={resumeAfterCapWarning}>
                Send anyway
              </DialogButton>
            )}
            {dialog.kind === 'session' && (
              <DialogButton type="secondary" onClick={startNewSession}>
                Start new session
              </DialogButton>
            )}
            <DialogButton type="primary" onClick={() => raiseCostCap(dialog.kind)}>
              Raise cap
            </DialogButton>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}
