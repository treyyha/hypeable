/**
 * Pull a `hypeable-plan` fence out of a model reply and parse it.
 */
import { parseHypeablePlan, type HypeablePlan } from './schema';

const FENCE_RE = /```hypeable-plan\s*([\s\S]*?)```/i;

export type ParsedPlan =
  { ok: true; plan: HypeablePlan; intro: string } | { ok: false; raw: string; intro: string; error: string };

export function extractPlanFence(text: string): string | null {
  const match = text.match(FENCE_RE);

  if (!match) {
    return null;
  }

  return match[1]?.trim() ?? '';
}

export function introFromPlanReply(text: string): string {
  const idx = text.search(/```hypeable-plan/i);

  if (idx < 0) {
    return text.trim();
  }

  return text.slice(0, idx).trim();
}

export function parsePlanReply(text: string): ParsedPlan {
  const intro = introFromPlanReply(text);
  const fenced = extractPlanFence(text);

  if (fenced === null) {
    return { ok: false, raw: text, intro, error: 'missing hypeable-plan fence' };
  }

  let json: unknown;

  try {
    json = JSON.parse(fenced);
  } catch {
    return { ok: false, raw: fenced || text, intro, error: 'plan JSON is not valid' };
  }

  const parsed = parseHypeablePlan(json);

  if (!parsed.ok) {
    return { ok: false, raw: fenced, intro, error: parsed.error };
  }

  return { ok: true, plan: parsed.plan, intro };
}
