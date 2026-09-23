export type Gate = "login" | "consent" | "console";

/** Single decision point for which view a path may render at a given auth state. */
export function resolveGate(path: string, authenticated: boolean): Gate {
	if (path === "/login") return "login";
	if (path === "/consent") return authenticated ? "consent" : "login";
	return authenticated ? "console" : "login";
}
