import { describe, expect, it } from "vitest";
import { oauthQueryExpired, oauthQueryFromLocation, restartAuthorizePath } from "../../frontend/src/oauthQuery";

// Signed consent query exactly as @better-auth/oauth-provider 1.7.5 emits it:
// `ba_param` is a REPEATED parameter enumerating every signed name.
const consentSearch =
	"response_type=code" +
	"&redirect_uri=https%3A%2F%2Fstor.msxor.com%2Fauth%2Fcallback" +
	"&scope=openid+profile+email" +
	"&state=cSJdi2_Mw2orwc988ZJYAQ" +
	"&client_id=nXkJYhtDkyjGbNHayEOhmjqVfwTKvlEW" +
	"&code_challenge=WOXDGIsidvmTgtGUaJUUFBtGsunuTKpuQRFJF49G5P0" +
	"&code_challenge_method=S256" +
	"&exp=1790531840" +
	"&ba_iat=1790531780559" +
	"&ba_param=ba_iat&ba_param=ba_param&ba_param=client_id&ba_param=code_challenge" +
	"&ba_param=code_challenge_method&ba_param=exp&ba_param=redirect_uri" +
	"&ba_param=response_type&ba_param=scope&ba_param=state" +
	"&sig=1ztaNN0uGSw0a8glUy1rn6Je4aLbRpn%2F3L94aQL51wI%3D";

describe("oauthQueryFromLocation", () => {
	it("keeps every parameter named by the repeated ba_param entries", () => {
		const reduced = oauthQueryFromLocation(consentSearch);
		expect(reduced).toBeTypeOf("string");
		const params = new URLSearchParams(reduced!);
		expect(params.get("response_type")).toBe("code");
		expect(params.get("redirect_uri")).toBe("https://stor.msxor.com/auth/callback");
		expect(params.get("scope")).toBe("openid profile email");
		expect(params.get("state")).toBe("cSJdi2_Mw2orwc988ZJYAQ");
		expect(params.get("client_id")).toBe("nXkJYhtDkyjGbNHayEOhmjqVfwTKvlEW");
		expect(params.get("code_challenge")).toBe("WOXDGIsidvmTgtGUaJUUFBtGsunuTKpuQRFJF49G5P0");
		expect(params.get("code_challenge_method")).toBe("S256");
		expect(params.get("exp")).toBe("1790531840");
		expect(params.get("ba_iat")).toBe("1790531780559");
		expect(params.getAll("ba_param")).toEqual([
			"ba_iat",
			"ba_param",
			"client_id",
			"code_challenge",
			"code_challenge_method",
			"exp",
			"redirect_uri",
			"response_type",
			"scope",
			"state",
		]);
		expect(params.get("sig")).toBe("1ztaNN0uGSw0a8glUy1rn6Je4aLbRpn/3L94aQL51wI=");
	});

	it("is a no-op when ba_param lists every parameter of the query", () => {
		// The server HMAC covers exactly these entries; dropping any of them
		// makes the consent endpoint fail with invalid_signature.
		expect(oauthQueryFromLocation(consentSearch)).toBe(consentSearch);
	});

	it("drops parameters that ba_param does not list", () => {
		const partial = "client_id=abc&foo=bar&ba_iat=1&ba_param=client_id&ba_param=ba_iat&sig=s";
		expect(oauthQueryFromLocation(partial)).toBe(
			"client_id=abc&ba_iat=1&ba_param=client_id&ba_param=ba_iat&sig=s",
		);
	});

	it("returns undefined without a signature", () => {
		expect(oauthQueryFromLocation("client_id=abc&ba_iat=1")).toBeUndefined();
	});

	it("returns undefined when signed parameter names are absent", () => {
		expect(oauthQueryFromLocation("client_id=abc&sig=s")).toBeUndefined();
	});
});

describe("oauthQueryExpired", () => {
	const q = "client_id=abc&exp=100&ba_iat=40000&ba_param=client_id&ba_param=exp&ba_param=ba_iat&sig=s";

	it("stays false inside the signature window (minus the skew guard)", () => {
		expect(oauthQueryExpired(q, 50_000)).toBe(false);
		expect(oauthQueryExpired(q, 89_999)).toBe(false);
	});

	it("turns true once exp passes, or when exp is missing", () => {
		expect(oauthQueryExpired(q, 90_001)).toBe(true);
		expect(oauthQueryExpired(q, 500_000)).toBe(true);
		expect(oauthQueryExpired("client_id=abc&sig=s", 0)).toBe(true);
	});
});

describe("restartAuthorizePath", () => {
	it("rebuilds /authorize from a signed query, dropping internal parameters", () => {
		const q = "response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Frp.example.com%2Fcb" +
			"&scope=openid+profile&state=xyz&resource=https%3A%2F%2Fmcp.example.com&prompt=login" +
			"&exp=100&ba_iat=40000&ba_pl=42&ba_param=response_type&ba_param=exp&sig=s";
		expect(restartAuthorizePath(q)).toBe("/api/auth/oauth2/authorize?" + new URLSearchParams([
			["response_type", "code"],
			["client_id", "abc"],
			["redirect_uri", "https://rp.example.com/cb"],
			["scope", "openid profile"],
			["state", "xyz"],
			["resource", "https://mcp.example.com"],
			["prompt", "login"],
		]).toString());
	});

	it("returns null without a signature", () => {
		expect(restartAuthorizePath("client_id=abc&exp=100")).toBeNull();
	});
});
