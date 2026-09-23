import { useState } from "react";
import { post } from "../api";
import { oauthQueryFromLocation } from "../oauthQuery";

export default function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function signInEmail() {
		setBusy(true);
		setError(null);
		try {
			await post("/api/auth/sign-in/email", { email, password, oauth_query: oauthQueryFromLocation(window.location.search) });
			window.location.href = "/";
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	async function signInGithub() {
		setBusy(true);
		setError(null);
		try {
			const result = await post<{ url?: string; redirectURI?: string }>("/api/auth/sign-in/social", {
				provider: "github",
				callbackURL: "/",
				oauth_query: oauthQueryFromLocation(window.location.search),
			});
			const url = result.url ?? result.redirectURI;
			if (!url) throw new Error("GitHub sign-in is not configured");
			window.location.href = url;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	return (
		<div className="auth-shell">
			<form
				className="auth-card"
				onSubmit={event => {
					event.preventDefault();
					if (!busy) void signInEmail();
				}}
			>
				<div className="brand">
					<img src="/favicon.svg" alt="" />
					<h1>MSAuth</h1>
				</div>
				<p className="auth-sub">Sign in to your identity console.</p>
				<label className="field">
					<span>Email</span>
					<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
				</label>
				<label className="field">
					<span>Password</span>
					<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
				</label>
				<button className="btn primary block" type="submit" disabled={busy || !email || !password}>
					Sign in
				</button>
				<div className="divider">or</div>
				<button className="btn block" type="button" disabled={busy} onClick={() => void signInGithub()}>
					<img src="/github.svg" alt="" width={17} height={17} /> Continue with GitHub
				</button>
				{error && <p className="error-note" role="alert">{error}</p>}
			</form>
		</div>
	);
}
