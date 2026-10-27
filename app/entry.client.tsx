import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { migrateApiKeysFromCookie } from '~/lib/api/api-key-storage';
import { deleteLegacyTokenCookies } from '~/lib/api/git-auth-storage';
import { migrateLegacyPrefCookies } from '~/lib/api/prefs-storage';
import '~/utils/clearLocks';

migrateApiKeysFromCookie();
migrateLegacyPrefCookies();
deleteLegacyTokenCookies();

startTransition(() => {
  hydrateRoot(document, <HydratedRouter />);
});
