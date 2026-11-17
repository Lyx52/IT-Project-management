/**
 * Development environment: `ng serve` runs on :4200 and the Laravel API on
 * :8001, so the API is cross-origin. Laravel's default CORS config allows
 * `api/*` from any origin, so no extra setup is needed.
 */
export const environment = {
  apiBaseUrl: 'http://localhost:8001/api/v1',
  privacyPolicyVersion: '1.0',
};
