import { describe, expect, it } from "vitest";
import { docsConstraints, docsSections } from "../../frontend/src/docsData";
import { toMarkdown } from "../../frontend/src/docsMarkdown";

/** Flatten every prose string and code block into one searchable corpus. */
function corpus(): string {
	const prose = docsSections.flatMap(section => [section.title, section.audience, ...section.steps]);
	const code = docsSections.flatMap(section => (section.code ? [section.code.label, section.code.content] : []));
	const constraints = docsConstraints.flatMap(constraint => [constraint.rule, constraint.detail]);
	return [...prose, ...code, ...constraints].join("\n");
}

describe("docsData — public integration guide contract", () => {
	it("covers the four integration paths with unique ids", () => {
		expect(docsSections.map(section => section.id)).toEqual(["web-app", "mcp-server", "agent", "m2m"]);
	});

	it("gives every section a title, audience and concrete steps", () => {
		for (const section of docsSections) {
			expect(section.title.trim().length).toBeGreaterThan(0);
			expect(section.audience.trim().length).toBeGreaterThan(0);
			expect(section.steps.length).toBeGreaterThan(0);
			for (const step of section.steps) expect(step.trim().length).toBeGreaterThan(0);
		}
	});

	it("documents the integration surfaces integrators actually call", () => {
		const text = corpus();
		expect(text).toContain("/api/auth/oauth2/authorize");
		expect(text).toContain("/.well-known/oauth-protected-resource");
		expect(text).toContain("authorizeToolCall");
		expect(text).toContain("AgentClient.create");
		expect(text).toContain("client_credentials");
		expect(text).toContain("dpop_jkt");
	});

	it("never points third parties at the browser-only management API", () => {
		const text = corpus();
		expect(text).not.toContain("/api/v1/");
	});

	it("states the platform invariants as explicit constraints", () => {
		expect(docsConstraints.length).toBeGreaterThanOrEqual(4);
		for (const constraint of docsConstraints) {
			expect(constraint.rule.trim().length).toBeGreaterThan(0);
			expect(constraint.detail.trim().length).toBeGreaterThan(0);
		}
	});
});

describe("toMarkdown — exportable source view", () => {
	const md = toMarkdown(docsSections, docsConstraints, key => `<${key}>`);

	it("runs every prose string through the translate function", () => {
		expect(md).toContain("# <Integration guide>");
		expect(md).toContain("## <Web & SPA applications>");
		expect(md).toContain("<Create an OAuth application in the console, or register dynamically through RFC 7591 DCR (public by default, kill-switchable).>");
	});

	it("renders steps as an ordered list and constraints as definition bullets", () => {
		expect(md).toContain("2. <Start the authorization-code flow with PKCE (S256), a state parameter and an exact resource identifier.>");
		expect(md).toContain("- **<Management API is browser-only>**: <All Authorization and x-api-key headers are stripped before session lookup; third-party tokens are never accepted there.>");
	});

	it("fences code blocks and labels them", () => {
		expect(md).toContain("### <Authorization request>");
		expect(md).toContain("```ts");
		expect(md).toContain('authorizeToolCall(claims, "https://mcp.example.com/mcp", "notes", "read");');
		expect(md).toContain("### <Agent SDK>");
	});

	it("always closes every fenced code block", () => {
		const fences = md.split("\n").filter(line => line.startsWith("```")).length;
		expect(fences % 2).toBe(0);
		expect(fences).toBeGreaterThan(0);
	});
});
