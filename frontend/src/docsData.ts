/**
 * Public integration guide content — pure data so tests can pin the contract
 * and the Docs page stays a dumb renderer. All prose strings are i18n keys
 * (English source); code blocks are technical and never translated.
 */

export interface DocsSection {
	id: string;
	title: string;
	audience: string;
	steps: string[];
	code?: { label: string; content: string; lang?: string };
}

export interface DocsConstraint {
	rule: string;
	detail: string;
}

export const docsSections: DocsSection[] = [
	{
		id: "web-app",
		title: "Web & SPA applications",
		audience: "Third-party apps that sign users in with MSAuth.",
		steps: [
			"Create an OAuth application in the console, or register dynamically through RFC 7591 DCR (public by default, kill-switchable).",
			"Start the authorization-code flow with PKCE (S256), a state parameter and an exact resource identifier.",
			"Show the hosted consent page, then swap the code for tokens at the token endpoint.",
			"Access tokens live 5 minutes; refresh tokens rotate on every use — store only the latest one.",
		],
		code: {
			label: "Authorization request",
			lang: "http",
			content: `GET /api/auth/oauth2/authorize?response_type=code
  &client_id=msa_...
  &redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback
  &scope=openid%20profile%20offline_access
  &state=...&code_challenge=...&code_challenge_method=S256
  &resource=https%3A%2F%2Fapp.example.com`,
		},
	},
	{
		id: "mcp-server",
		title: "MCP servers & protected resources",
		audience: "Resource servers that must validate a token on every tool call.",
		steps: [
			"An operator registers the resource: exact HTTPS identifier, 300-second token TTL, DPoP required.",
			"Publish RFC 9728 metadata at /.well-known/oauth-protected-resource so MCP hosts discover this server.",
			"Validate access tokens locally against the published JWKS: audience, expiry and the cnf.jkt DPoP binding.",
			"Gate every tool call through the RAR helper — mcp_tool authorization details decide authority.",
		],
		code: {
			label: "Resource server integration",
			content: `import { createProtectedResourceMetadata, authorizeToolCall } from "msauth/sdk";

// serve as /.well-known/oauth-protected-resource
createProtectedResourceMetadata("https://mcp.example.com/mcp", "https://auth.msxor.com");

// before every tool call
authorizeToolCall(claims, "https://mcp.example.com/mcp", "notes", "read");`,
		},
	},
	{
		id: "agent",
		title: "AI agents & delegated authority",
		audience: "Agents acting on a user's behalf under an explicit, narrowing delegation.",
		steps: [
			"Register an agent in the console: bind an OAuth client plus a P-256 public JWK — the private key never leaves the agent.",
			"Create a delegation: one exact resource, scopes, RAR details, lifetime between one minute and 30 days.",
			"Run the SDK flow: PKCE authorize (with dpop_jkt), code exchange, then a token exchange against the delegation.",
			"Delegated tokens live at most 5 minutes, are DPoP-bound to the agent key, pin one audience and can never refresh.",
			"Agents may sub-delegate to child agents — narrowing only, chain depth up to 4.",
		],
		code: {
			label: "Agent SDK",
			content: `const agent = await AgentClient.create({ issuer, clientId, resource });
const flow = await agent.authorize(redirectUri, ["mcp:invoke"]);
const tokens = await agent.complete(callbackUrl, flow);
const delegated = await agent.exchange(delegationId, tokens.access_token);
const res = await agent.fetch(resource + "/tools/1"); // DPoP proof attached`,
		},
	},
	{
		id: "m2m",
		title: "Machine-to-machine workloads",
		audience: "Scripts, CI jobs and services without a user context.",
		steps: [
			"Use a confidential client with the client_credentials grant for short-lived (300 s) service tokens.",
			"Or use an API key: msa_ prefix, 30-day default expiry, rate-limited per key.",
			"API keys never open the management API — that surface is browser-session-only by design.",
		],
	},
];

export const docsConstraints: DocsConstraint[] = [
	{
		rule: "Management API is browser-only",
		detail: "All Authorization and x-api-key headers are stripped before session lookup; third-party tokens are never accepted there.",
	},
	{
		rule: "Consent is explicit",
		detail: "The /authorize endpoint rejects inline authorization_details — authority flows only through registered delegations.",
	},
	{
		rule: "Token lifetime is capped",
		detail: "Resource-scoped access tokens never exceed 300 seconds, and delegated tokens inherit the shortest chain expiry.",
	},
	{
		rule: "Audience pinning",
		detail: "Every token is bound to exactly one HTTPS resource identifier and refuses to widen it.",
	},
];
