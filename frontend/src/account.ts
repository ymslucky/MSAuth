/**
 * Account-form pure logic. Password rules mirror Better Auth's default
 * (min length 8) so the form gives instant feedback before the server does.
 */

export type PasswordChangeError = "short" | "mismatch";

export function validatePasswordChange(newPassword: string, confirm: string): PasswordChangeError | null {
	if (newPassword.length < 8) return "short";
	if (newPassword !== confirm) return "mismatch";
	return null;
}
