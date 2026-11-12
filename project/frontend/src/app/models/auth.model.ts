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
  /** From GET /api/v1/captcha. Each challenge allows one attempt. */
  captcha_id: string;
  captcha_answer: string;
}

/**
 * 200 body of GET /api/v1/captcha. The answer is kept server-side and is
 * never part of this response.
 */
export interface CaptchaChallenge {
  captcha_id: string;
  /** Ready to display, e.g. "What is 7 + 5?". */
  question: string;
  /** Seconds until the challenge can no longer be answered. */
  expires_in: number;
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
  /**
   * True only while the backend has e-mail verification turned on and this
   * address is unconfirmed. Posting is refused until then. Drive the "verify
   * your e-mail" prompt from this, not from `email_verified_at`, which stays
   * null for every new account while verification is turned off.
   */
  must_verify_email: boolean;
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
 * 200 body of /login. The user is nested inside a plain array server-side, so
 * JsonResource does not add its `data` wrapper here. GET /user returns the
 * resource directly and therefore IS wrapped.
 */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

/** 200 body of GET /api/v1/user, which returns UserResource directly. */
export interface CurrentUserResponse {
  data: AuthUser;
}

/** 202 body of POST /api/v1/email/resend. 409 when already verified. */
export interface ResendVerificationResponse {
  message: string;
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
