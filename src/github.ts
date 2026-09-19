/** GitHub API client for the pieces OpenAuth needs after a login. */

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