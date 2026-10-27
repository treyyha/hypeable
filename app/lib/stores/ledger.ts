/**
 * Browser-local spend ledger store. Settled usages append here; the Spend
 * page reads this list. Never sent to a server.
 */
import { atom } from 'nanostores';
import { persistLedgerEntry, readLedger, type LedgerEntry } from '~/lib/cost/ledger';
import { chatId, description } from '~/lib/persistence/chat-meta';

const browserStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const ledgerStore = atom<LedgerEntry[]>(readLedger(browserStorage()).entries);

export function recordLedgerFromUsage(input: Omit<LedgerEntry, 'timestamp' | 'chatId' | 'chatName'>): void {
  const snapshot = persistLedgerEntry(browserStorage(), {
    ...input,
    timestamp: Date.now(),
    chatId: chatId.get(),
    chatName: description.get(),
  });

  ledgerStore.set(snapshot.entries);
}
