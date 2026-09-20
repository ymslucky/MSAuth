/** GitHub API client for the pieces OpenAuth needs after a login. */

import { readSecret } from "./secrets";


/**
 * Exchanges a GitHub authorization code for an access token.
 */
export async function exchangeGithubCode(
	env: Env,
	code: string,
	redirectUri: string,
): Promise<string> {
	const res = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify({
			client_id: await readSecret(env.GITHUB_CLIENT_ID),
			client_secret: await readSecret(env.GITHUB_CLIENT_SECRET),
			code,
			redirect_uri: redirectUri,
		}),
	});
	if (!res.ok) {
		throw new Error("github token exchange failed: " + res.status);
	}
	const data = (await res.json()) as { access_token?: string; error?: string };
	if (!data.access_token) {
		throw new Error("github token exchange error: " + (data.error ?? "no token"));
	}
	return data.access_token;
}

export async function getGithubEmail(accessToken: string): Promise<string> {
	const response = await fetch("https://api.github.com/user/emails", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "msauth-worker",
		},
	});
	if (!response.ok) {
		throw new Error(`Unable to fetch GitHub emails: ${response.status}`);
	}
	const emails = (await response.json()) as {
		email: string;
		primary: boolean;
		verified: boolean;
	}[];
	// Prefer the primary verified email, then any verified email.
	const primary =
		emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
	if (!primary) {
		throw new Error("No verified GitHub email available");
	}
	return primary.email;
}