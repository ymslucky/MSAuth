/** Shared constants for the auth worker. */

/** OpenAuth client id used by the admin console itself. */
export const ADMIN_CLIENT_ID = "admin-ui";

export const SESSION_COOKIE = "__Host-admin_session";
export const OAUTH_STATE_COOKIE = "__Host-admin_oauth";

/** Absolute admin session lifetime. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Maximum length of the user search query. */
export const MAX_QUERY_LENGTH = 200;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;