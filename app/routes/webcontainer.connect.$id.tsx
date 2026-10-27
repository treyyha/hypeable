import type { LoaderFunction } from 'react-router';

/**
 * Leftover StackBlitz editor-connect page. It interpolated `editorOrigin` into
 * HTML and loaded `@latest` from jsdelivr. Unused by Hypeable; 404 so it cannot
 * be used as XSS or a supply-chain fetch.
 */
export const loader: LoaderFunction = async () => {
  return new Response(null, { status: 404 });
};
