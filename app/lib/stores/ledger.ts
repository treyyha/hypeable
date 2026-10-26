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

export function recordLedgerFromUsage(input: {
  id: string;
  model: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  dollars: number;
  verified?: boolean;
}): void {
  const snapshot = persistLedgerEntry(browserStorage(), {
    id: input.id,
    timestamp: Date.now(),
    chatId: chatId.get(),
    chatName: description.get(),
    model: input.model,
    provider: input.provider,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    dollars: input.dollars,
    verified: input.verified,
  });

  ledgerStore.set(snapshot.entries);
}
