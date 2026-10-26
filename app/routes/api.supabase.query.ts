import type { ActionFunctionArgs } from 'react-router';
import { getSupabaseAccessToken } from '~/lib/api/connector-tokens';
import { parseStrictJson, supabaseQueryBodySchema } from '~/lib/predeploy/deploy-request';
import { withSecurity } from '~/lib/security';
import { assertSameOrigin } from '~/lib/security/origin';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.supabase.query');

async function supabaseQueryAction({ request }: ActionFunctionArgs) {
  assertSameOrigin(request);

  const token = getSupabaseAccessToken(request);

  if (!token) {
    return Response.json({ error: 'Not connected to Supabase' }, { status: 401 });
  }

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { projectId, query } = parseStrictJson(supabaseQueryBodySchema, json);

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      logger.error('Supabase API error:', response.status);

      return Response.json({ error: 'Query failed' }, { status: response.status });
    }

    const result = await response.json();

    return Response.json(result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    logger.error('Query execution error:', error);

    return Response.json({ error: 'Query execution failed' }, { status: 500 });
  }
}

export const action = withSecurity(supabaseQueryAction, { allowedMethods: ['POST'] });
