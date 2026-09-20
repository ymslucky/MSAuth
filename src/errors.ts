/**
 * Typed API error: handlers throw, the dispatcher converts to JSON.
 */
export class ApiError extends Error {
	constructor(
		readonly code: string,
		readonly status: number,
	) {
		super(code);
	}
}

/** Management API error codes (also mirrored by the console UI). */
export const ErrorCodes = {
	Unauthorized: "unauthorized",
	Forbidden: "forbidden",
	NotFound: "not_found",
	InvalidEmail: "invalid_email",
	EmailTaken: "email_taken",
	InvalidRoles: "invalid_roles",
	UnknownRole: "unknown_role",
	LastAdmin: "last_admin",
	CannotDeleteSelf: "cannot_delete_self",
	BuiltinRole: "builtin_role",
	InvalidName: "invalid_name",
	RoleTaken: "role_taken",
	InvalidCode: "invalid_code",
	PermissionTaken: "permission_taken",
	PermissionTaken409: "permission_taken",
	RateLimited: "rate_limited",
	InternalError: "internal_error",
} as const;