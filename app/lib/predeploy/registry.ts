/**
 * Ordered rule list for the pre-deploy scan.
 */

import { clientAdminCheckRule } from './rules/client-admin';
import { clientPriceTrustRule } from './rules/client-price';
import { clientSecretRule } from './rules/client-secret';
import { corsWildcardRule } from './rules/cors-wildcard';
import { dotenvCommittedRule } from './rules/dotenv-committed';
import { firebaseOpenRulesRule } from './rules/firebase-open';
import { missingGitignoreRule, missingSecurityHeadersRule } from './rules/info';
import { insecureHttpRule } from './rules/insecure-http';
import { localStorageTokenRule } from './rules/localstorage-token';
import { secretLeakRule } from './rules/secret-leak';
import { sqlInjectionRule } from './rules/sql-injection';
import { supabaseRlsMissingRule, supabaseRlsOpenRule, supabaseRlsUnverifiedRule } from './rules/supabase-rls';
import { unauthenticatedWriteRule } from './rules/unauthenticated-write';
import { unpinnedDependencyRule } from './rules/unpinned-dep';
import { unsafeHtmlRule } from './rules/unsafe-html';
import type { PredeployRule } from './types';

export const PREDEPLOY_RULES: PredeployRule[] = [
  secretLeakRule,
  clientSecretRule,
  dotenvCommittedRule,
  supabaseRlsMissingRule,
  supabaseRlsOpenRule,
  firebaseOpenRulesRule,
  corsWildcardRule,
  localStorageTokenRule,
  unsafeHtmlRule,
  sqlInjectionRule,
  insecureHttpRule,
  clientAdminCheckRule,
  supabaseRlsUnverifiedRule,
  unauthenticatedWriteRule,
  clientPriceTrustRule,
  unpinnedDependencyRule,
  missingSecurityHeadersRule,
  missingGitignoreRule,
];

export function ruleById(id: string): PredeployRule | undefined {
  return PREDEPLOY_RULES.find((rule) => rule.id === id);
}
