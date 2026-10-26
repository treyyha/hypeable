import type { LoaderFunctionArgs } from 'react-router';
import { BUILD_COMMIT } from '~/lib/commit';
import { isHostedFromContext } from '~/lib/security/hosted';

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return Response.json({
    ok: true,
    hosted: isHostedFromContext(context),
    commit: BUILD_COMMIT,
  });
};
