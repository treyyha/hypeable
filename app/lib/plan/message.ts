/**
 * The internal follow-up that starts the real build from an approved plan.
 */
import type { HypeablePlan } from './schema';

export function defaultTickedFeatureIds(plan: HypeablePlan): string[] {
  return plan.features.filter((feature) => feature.optional !== true).map((feature) => feature.id);
}

export function planWithTickedFeatures(plan: HypeablePlan, tickedIds: readonly string[]): HypeablePlan {
  const allowed = new Set(tickedIds);

  return {
    ...plan,
    features: plan.features.filter((feature) => allowed.has(feature.id)),
  };
}

export function formatPlanMarkdown(plan: HypeablePlan): string {
  const lines = [
    `# ${plan.title}`,
    '',
    plan.summary,
    '',
    '## Pages',
    ...plan.pages.map((page) => `- ${page.name}: ${page.purpose}`),
    '',
    '## Data',
    ...plan.data.map((row) => `- ${row.entity} (${row.storage})`),
    '',
    '## Features',
    ...plan.features.map((feature) => `- ${feature.text}`),
    '',
    '## Stack',
    ...plan.stack.map((item) => `- ${item}`),
    '',
    '## Assumptions',
    ...plan.assumptions.map((item) => `- ${item}`),
    '',
    '## Risks',
    ...plan.risks.map((item) => `- ${item}`),
  ];

  return lines.join('\n');
}

export function buildApprovedPlanMessage(plan: HypeablePlan, tickedIds: readonly string[]): string {
  const approved = planWithTickedFeatures(plan, tickedIds);
  const markdown = formatPlanMarkdown(approved);

  return [
    'Build exactly this. First create PLAN.md in the project containing the approved plan, then build.',
    '',
    markdown,
  ].join('\n');
}

export function buildLoopPlanContext(input: { error: string; count: number; tried?: readonly string[] }): string {
  const error = input.error.trim() || 'unknown error';
  const tried = (input.tried ?? []).map((item) => item.trim()).filter(Boolean);

  const triedBlock =
    tried.length > 0 ? tried.map((item) => `- ${item}`).join('\n') : '- repeating the same fix for this error';

  return [
    '[Hypeable loop breaker] The previous approach is stuck. Do NOT repeat it.',
    `The same error failed ${input.count} times:`,
    '```',
    error,
    '```',
    `Already tried:\n${triedBlock}`,
    'Produce a NEW plan for a different approach. Do not write code yet.',
  ].join('\n\n');
}
