import type { LoaderFunctionArgs } from 'react-router';
import { isHostedFromContext } from '~/lib/security/hosted';

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return Response.json({
    ok: true,
    hosted: isHostedFromContext(context),
  });
};
