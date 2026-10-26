import type { LoaderFunctionArgs } from 'react-router';
import { hostedNotFoundIfEnabled } from '~/lib/security/hosted';
import { MCPService } from '~/lib/services/mcpService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.mcp-check');

export async function loader({ context }: LoaderFunctionArgs) {
  const blocked = hostedNotFoundIfEnabled(context);

  if (blocked) {
    return blocked;
  }

  try {
    const mcpService = MCPService.getInstance();
    const serverTools = await mcpService.checkServersAvailabilities();

    return Response.json(serverTools);
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return Response.json({ error: 'Failed to check MCP servers' }, { status: 500 });
  }
}
