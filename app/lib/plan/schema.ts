/**
 * Shape of a `hypeable-plan` JSON fence. Parsed with zod so a malformed
 * model reply never becomes a fake plan.
 */
import { z } from 'zod';

const pageSchema = z
  .object({
    name: z.string().min(1),
    purpose: z.string().min(1),
  })
  .strict();

const dataSchema = z
  .object({
    entity: z.string().min(1),
    storage: z.string().min(1),
  })
  .strict();

const featureSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    optional: z.boolean().optional(),
  })
  .strict();

export const hypeablePlanSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    pages: z.array(pageSchema),
    data: z.array(dataSchema),
    features: z.array(featureSchema),
    stack: z.array(z.string()),
    assumptions: z.array(z.string()),
    risks: z.array(z.string()),
  })
  .strict();

export type HypeablePlan = z.infer<typeof hypeablePlanSchema>;
export type HypeablePlanFeature = z.infer<typeof featureSchema>;
export type HypeablePlanPage = z.infer<typeof pageSchema>;
export type HypeablePlanData = z.infer<typeof dataSchema>;

export function parseHypeablePlan(value: unknown): { ok: true; plan: HypeablePlan } | { ok: false; error: string } {
  const result = hypeablePlanSchema.safeParse(value);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.length ? issue.path.join('.') : '(root)';

    return { ok: false, error: `${path}: ${issue?.message ?? 'invalid plan'}` };
  }

  return { ok: true, plan: result.data };
}
