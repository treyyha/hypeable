/**
 * Zod bodies for Vercel/Netlify publish. Token is the user's, per request.
 */

import { z } from 'zod';

const fileMap = z.record(z.string().max(1024), z.string());

export const vercelDeployBodySchema = z
  .object({
    projectId: z.string().max(256).optional(),
    files: fileMap,
    sourceFiles: fileMap.optional(),
    token: z.string().min(1).max(8192).optional(),
    chatId: z.string().min(1).max(256),
    framework: z.string().max(64).optional(),
    acknowledgedRisk: z.boolean().optional(),
  })
  .strict();

export const netlifyDeployBodySchema = z
  .object({
    siteId: z.string().max(256).optional(),
    files: fileMap,
    token: z.string().min(1).max(8192).optional(),
    chatId: z.string().min(1).max(256),
    acknowledgedRisk: z.boolean().optional(),
  })
  .strict();

export const gitlabProjectsBodySchema = z
  .object({
    token: z.string().min(1).max(8192).optional(),
    gitlabUrl: z.string().max(2048).optional(),
  })
  .strict();

export const supabaseProjectsBodySchema = z
  .object({
    token: z.string().min(1).max(8192).optional(),
  })
  .strict();

const supabaseProjectId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const supabaseQueryBodySchema = z
  .object({
    projectId: supabaseProjectId,
    query: z.string().min(1).max(100_000),
  })
  .strict();

export const supabaseVariablesBodySchema = z
  .object({
    projectId: supabaseProjectId,
    token: z.string().min(1).max(8192).optional(),
  })
  .strict();

export type VercelDeployBody = z.infer<typeof vercelDeployBodySchema>;
export type NetlifyDeployBody = z.infer<typeof netlifyDeployBodySchema>;

export function parseStrictJson<T>(schema: z.ZodType<T>, json: unknown): T {
  const result = schema.safeParse(json);

  if (!result.success) {
    throw new Response(JSON.stringify({ error: 'Invalid input' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return result.data;
}
