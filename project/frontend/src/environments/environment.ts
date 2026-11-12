/**
 * Default (production) environment.
 *
 * In production Caddy serves the SPA and reverse-proxies `/api/*` to the
 * backend on the same origin (see docker/prod/proxy/Caddyfile), so a relative
 * base URL is correct and avoids CORS entirely.
 *
 * The `development` build configuration replaces this file with
 * `environment.development.ts` (see angular.json fileReplacements).
 */
export const environment = {
  apiBaseUrl: '/api/v1',

  /**
   * Version recorded as accepted on sign-up, sent as `privacy_policy_version`.
   * Must match the version the backend considers published. The backend does
   * not yet expose or validate this, so it is pinned here to the same '1.0'
   * used by CreateAdminCommand and UserFactory.
   */
  privacyPolicyVersion: '1.0',
};
