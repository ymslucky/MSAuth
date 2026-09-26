/**
 * Client-side mirror of the server RAR policy (src/agent/policy.ts) so the
 * delegation form validates inputs instantly instead of round-tripping 400s.
 * The server stays authoritative — this only gates obvious mistakes.
 */

export const RAR_MAX_LIST = 32;
export const RAR_MAX_STRING = 256;

export interface McpToolDetail {
	type: "mcp_tool";
	locations: string[];
	actions: string[];
	identifiers: string[];
}

/** Split free text (comma / semicolon / newline separated) into trimmed, deduped, non-empty entries. */
export function parseListInput(text: string): string[] {
	const seen = new Set<string>();
	for (const raw of text.split(/[,;\n]/)) {
		const value = raw.trim();
		if (value) seen.add(value);
	}
	return [...seen];
}

/** Mirror of validateResource: exact HTTPS URI, no credentials, no fragment, no wildcard. */
export function isValidResource(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !url.hash && !value.includes("*");
	} catch {
		return false;
	}
}

function validList(values: string[]): boolean {
	return values.length >= 1 && values.length <= RAR_MAX_LIST &&
		values.every(value => value.length <= RAR_MAX_STRING && !value.includes("*"));
}

/**
 * Build the single mcp_tool authorization detail with locations locked to the
 * exact resource. Returns `{ ok: false, error }` naming the offending field
 * ("resource" | "actions" | "identifiers") so the form can point at it.
 */
export function buildAuthorizationDetail(
	resource: string,
	actions: string[],
	identifiers: string[],
): { ok: true; detail: McpToolDetail } | { ok: false; error: "resource" | "actions" | "identifiers" } {
	if (!isValidResource(resource)) return { ok: false, error: "resource" };
	if (!validList(actions)) return { ok: false, error: "actions" };
	if (!validList(identifiers)) return { ok: false, error: "identifiers" };
	return {
		ok: true,
		detail: {
			type: "mcp_tool",
			locations: [resource],
			actions: [...new Set(actions)],
			identifiers: [...new Set(identifiers)],
		},
	};
}
