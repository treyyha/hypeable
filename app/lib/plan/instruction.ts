/**
 * Extra system instruction for a planning turn. The model must not emit
 * artifacts — only a short intro and one `hypeable-plan` fence.
 */

export const PLAN_FENCE = 'hypeable-plan';

export const PLAN_INSTRUCTION =
  'Do NOT output any boltArtifact/actions. Reply with a short intro and ONE fenced block ```hypeable-plan containing JSON: {title, summary, pages:[{name,purpose}], data:[{entity,storage}], features:[{id,text,optional:boolean}], stack:[...], assumptions:[...], risks:[...]}';

export const MAX_PLAN_RETRIES = 2;
