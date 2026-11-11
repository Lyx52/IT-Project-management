/**
 * Contract for POST /api/v1/register.
 * Field names are snake_case because they must match the backend
 * RegisterRequest rules exactly (app/Http/Requests/RegisterRequest.php).
 */
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  terms_accepted: boolean;
  privacy_policy_version: string;
}

/** The user as returned by UserResource. Never contains the password. */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  email_verified_at: string | null;
}

/**
 * 201 body of /register. Laravel's JsonResource wraps a resource that is
 * returned directly, and the backend does not call withoutWrapping(), so the
 * user arrives nested under `data`.
 */
export interface RegisterResponse {
  data: AuthUser;
}

/** Laravel's 422 body: one array of messages per rejected field. */
export interface ValidationErrorBody {
  message: string;
  errors: Record<string, string[]>;
}
