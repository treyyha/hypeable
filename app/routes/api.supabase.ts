import type { ActionFunctionArgs } from 'react-router';
import { getSupabaseAccessToken } from '~/lib/api/connector-tokens';
import { parseStrictJson, supabaseProjectsBodySchema } from '~/lib/predeploy/deploy-request';
import { withSecurity } from '~/lib/security';
import { assertSameOrigin } from '~/lib/security/origin';
import type { SupabaseProject } from '~/types/supabase';

async function supabaseProjectsAction({ request }: ActionFunctionArgs) {
  try {
    assertSameOrigin(request);

    let json: unknown;

    try {
      json = await request.json();
    } catch {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    const body = parseStrictJson(supabaseProjectsBodySchema, json);
    const token = getSupabaseAccessToken(request, undefined, body.token);

    if (!token) {
      return Response.json({ error: 'Not connected to Supabase' }, { status: 401 });
    }

    const projectsResponse = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectsResponse.ok) {
      console.error('Projects fetch failed:', projectsResponse.status);

      return Response.json({ error: 'Failed to fetch projects' }, { status: 401 });
    }

    const projects = (await projectsResponse.json()) as SupabaseProject[];

    const uniqueProjectsMap = new Map<string, SupabaseProject>();

    for (const project of projects) {
      if (!uniqueProjectsMap.has(project.id)) {
        uniqueProjectsMap.set(project.id, project);
      }
    }

    const uniqueProjects = Array.from(uniqueProjectsMap.values());

    uniqueProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return Response.json({
      user: { email: 'Connected', role: 'Admin' },
      stats: {
        projects: uniqueProjects,
        totalProjects: uniqueProjects.length,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('Supabase API error:', error);

    return Response.json({ error: 'Authentication failed' }, { status: 401 });
  }
}

export const action = withSecurity(supabaseProjectsAction, { allowedMethods: ['POST'] });
