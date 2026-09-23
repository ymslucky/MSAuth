export interface AuthorizationDetail {
  type: "mcp_tool";
  locations: string[];
  actions: string[];
  identifiers: string[];
}

export function validateResource(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || value.includes("*")) {
    throw new Error("Resource must be an exact HTTPS URI without credentials or fragments");
  }
  return url.href;
}

export function validateRedirect(value: string): string {
  const url = new URL(value);
  const loopback = ["127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol === "http:";
  if (!loopback) return validateResource(value);
  if (url.username || url.password || url.hash || value.includes("*")) throw new Error("Invalid redirect URI");
  return url.href;
}

function strings(input: unknown): string[] {
  if (!Array.isArray(input) || !input.length || input.length > 32 ||
    input.some(v => typeof v !== "string" || !v.trim() || v.length > 256 || v.includes("*"))) {
    throw new Error("Expected a non-empty explicit list");
  }
  return [...new Set(input)] as string[];
}

/** MSAuth's RAR profile deliberately rejects unknown fields rather than ignoring authority. */
export function parseAuthorization(input: unknown): AuthorizationDetail[] {
  if (!Array.isArray(input) || !input.length || input.length > 16) throw new Error("Invalid authorization_details");
  return input.map(value => {
    if (!value || typeof value !== "object" || value.type !== "mcp_tool" ||
      Object.keys(value).some(key => !["type", "locations", "actions", "identifiers"].includes(key))) {
      throw new Error("Unsupported authorization_details");
    }
    return {
      type: "mcp_tool",
      locations: strings(value.locations).map(validateResource),
      actions: strings(value.actions),
      identifiers: strings(value.identifiers),
    };
  });
}

export function subset(child: readonly string[], parent: readonly string[]): boolean {
  return child.every(value => parent.includes(value));
}

export function narrowAuthorization(parent: unknown, child: unknown): AuthorizationDetail[] {
  const source = parseAuthorization(parent);
  const requested = parseAuthorization(child);
  for (const detail of requested) {
    if (!source.some(grant => grant.type === detail.type &&
      subset(detail.locations, grant.locations) && subset(detail.actions, grant.actions) &&
      subset(detail.identifiers, grant.identifiers))) throw new Error("Delegation may only narrow authority");
  }
  return requested;
}
