/**
 * Narrow-screen Chat | Preview | Code switch. Desktop keeps the split pane.
 */

import { chatStore, type MobilePane } from '~/lib/stores/chat';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';

export type { MobilePane };

export function setMobilePane(pane: MobilePane): void {
  chatStore.setKey('mobilePane', pane);

  if (pane === 'chat') {
    chatStore.setKey('showChat', true);
    workbenchStore.showWorkbench.set(false);

    return;
  }

  chatStore.setKey('showChat', false);
  workbenchStore.showWorkbench.set(true);

  const view: WorkbenchViewType = pane;
  workbenchStore.selectWorkbenchView(view, { userInitiated: true });
}
