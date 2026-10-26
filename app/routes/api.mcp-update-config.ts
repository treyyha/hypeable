import type { ActionFunctionArgs } from 'react-router';
import { hostedNotFoundIfEnabled } from '~/lib/security/hosted';
import { mcpConfigSchema } from '~/lib/services/mcpService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.mcp-update-config');

const updateConfigSchema = mcpConfigSchema.strict();

export async function action({ request, context }: ActionFunctionArgs) {
  const blocked = hostedNotFoundIfEnabled(context);

  if (blocked) {
    return blocked;
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid MCP servers configuration' }, { status: 400 });
    }

    const parsed = updateConfigSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: 'Invalid MCP servers configuration' }, { status: 400 });
    }

    /*
     * Empty config is the onboarding default. Return without constructing
     * MCP clients — that path used to load Node stdio inside the Cloudflare
     * worker and abort the request, which the browser reports as "Failed to fetch".
     */
    if (Object.keys(parsed.data.mcpServers).length === 0) {
      return Response.json({});
    }

    const mcpModule = await import('~/lib/services/mcpService');
    const mcpService = mcpModule.MCPService.getInstance();
    const serverTools = await mcpService.updateConfig(parsed.data);

    return Response.json(serverTools);
  } catch (error) {
    logger.error('Error updating MCP config:', error);
    return Response.json({ error: 'Failed to update MCP config' }, { status: 500 });
  }
}
