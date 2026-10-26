/**
 * Client spend dashboard. Cost store and ledger stay in this browser.
 */
import { useStore } from '@nanostores/react';
import { SpendView } from './SpendView';
import { costStore } from '~/lib/stores/cost';
import { ledgerStore } from '~/lib/stores/ledger';

export function SpendPage() {
  const snapshot = useStore(costStore);
  const entries = useStore(ledgerStore);

  return <SpendView snapshot={snapshot} entries={entries} />;
}
