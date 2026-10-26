import type { ActionFunctionArgs } from 'react-router';
import { getSupabaseAccessToken } from '~/lib/api/connector-tokens';
import { parseStrictJson, supabaseVariablesBodySchema } from '~/lib/predeploy/deploy-request';
import { withSecurity } from '~/lib/security';
import { assertSameOrigin } from '~/lib/security/origin';

async function supabaseVariablesAction({ request }: ActionFunctionArgs) {
  try {
    assertSameOrigin(request);

    let json: unknown;

    try {
      json = await request.json();
    } catch {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    const body = parseStrictJson(supabaseVariablesBodySchema, json);
    const token = getSupabaseAccessToken(request, undefined, body.token);

    if (!token) {
      return Response.json({ error: 'Not connected to Supabase' }, { status: 401 });
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${body.projectId}/api-keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch API keys' }, { status: response.status });
    }

    const apiKeys = await response.json();

    return Response.json({ apiKeys });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('Error fetching project API keys:', error);

    return Response.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export const action = withSecurity(supabaseVariablesAction, { allowedMethods: ['POST'] });
