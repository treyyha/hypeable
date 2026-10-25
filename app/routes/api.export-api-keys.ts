import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async () => {
  /*
   * Keys are stored in the browser (localStorage / sessionStorage) and are
   * never sent to this route. Export is a client-side read of that storage.
   */
  return Response.json(
    { error: 'API keys are stored in the browser and cannot be exported from the server.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
};
