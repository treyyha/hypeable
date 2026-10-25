/**
 * Dollars burned since the first repeated error, from the cost meter snapshot.
 */
import { roundDollars } from '~/lib/cost/calc';

export type CostLikeRecord = {
  dollars?: number;
  pending?: boolean;
};

export function wastedCostSince(sessionTotalNow: number, sessionTotalAtFirst: number): number {
  return roundDollars(Math.max(0, sessionTotalNow - sessionTotalAtFirst));
}

export function sumMessageCostsSince(messages: Record<string, CostLikeRecord>, ids: readonly string[]): number {
  let total = 0;

  for (const id of ids) {
    const record = messages[id];

    if (!record || record.pending) {
      continue;
    }

    total += record.dollars ?? 0;
  }

  return roundDollars(Math.max(0, total));
}
