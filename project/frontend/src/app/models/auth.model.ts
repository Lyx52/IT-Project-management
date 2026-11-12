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

/**
 * Contract for POST /api/v1/login (app/Http/Requests/Api/V1/LoginRequest.php).
 * The identifier is the e-mail address, which the backend lowercases and trims.
 *
 * `device_name` is optional and names the row in `personal_access_tokens`.
 * The backend defaults it to 'auth_token'; sending something meaningful makes
 * the tokens distinguishable once there is more than one client.
 */
export interface LoginPayload {
  email: string;
  password: string;
  device_name?: string;
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

/**
 * 200 body of /login.
 *
 * Note what is NOT here: the endpoint returns the token and nothing else, so a
 * successful sign-in tells us nothing about who signed in beyond the address
 * they typed. Sanctum tokens are opaque database keys, not JWTs, so there are
 * no claims to decode either. Showing the username in the header (AC1 of #74)
 * needs the backend to either return the user here or add GET /api/v1/user.
 */
export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/** 200 body of /logout. The message is not shown to the user. */
export interface LogoutResponse {
  message: string;
}

/** Laravel's 422 body: one array of messages per rejected field. */
export interface ValidationErrorBody {
  message: string;
  errors: Record<string, string[]>;
}
