import { useEffect, useRef, useState } from "react";
import { post } from "../api";
import { oauthQueryFromLocation } from "../oauthQuery";
import { LangSegmented, useT } from "../i18n";
import { ThemeToggle, scenePalette, useTheme } from "../theme";
import { Button } from "../ui";
import { mountLoginScene } from "../scene";

export default function Login() {
	const t = useT();
	const { resolved } = useTheme();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const sceneRef = useRef<HTMLCanvasElement>(null);

	// Identity constellation on paper; the CSS paper gradient stays visible
	// until (and unless) the lazy three.js chunk takes over the canvas.
	// Re-mounts on theme flips so the constellation re-inks for dark mode.
	useEffect(() => {
		const canvas = sceneRef.current;
		if (!canvas) return undefined;
		return mountLoginScene(canvas, scenePalette(resolved));
	}, [resolved]);

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
			if (!url) throw new Error(t("GitHub sign-in is not configured"));
			window.location.href = url;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	return (
		<div className="login-page">
			<div className="login-brand">
				<canvas ref={sceneRef} className="login-scene" aria-hidden="true" />
				<div className="login-scrim" aria-hidden="true" />
				<div className="login-brand-inner">
					<div className="brand-row">
						<div className="brand"><img src="/favicon.svg" alt="" />MSAuth</div>
						<span className="controls-row"><LangSegmented /><ThemeToggle /></span>
					</div>
					<p className="login-brand-welcome">{t("A quiet ledger for identity.")}</p>
					<p className="login-story">{t("MSAuth is the identity layer for individuals and one-person companies — OAuth clients, API keys and DPoP-bound agents, governed from one console.")}</p>
					<ul className="login-feats">
						<li>{t("OAuth 2.1 clients and API keys")}</li>
						<li>{t("DPoP-bound agents with audited delegation chains")}</li>
						<li>{t("Every mutation on the record")}</li>
					</ul>
				</div>
			</div>
			<div className="login-form-col">
				<div className="login-toggle"><span className="controls-row"><LangSegmented /><ThemeToggle /></span></div>
				<form
					className="auth-card"
					onSubmit={event => {
						event.preventDefault();
						if (!busy) void signInEmail();
					}}
				>
					<div className="brand login-brand-compact"><img src="/favicon.svg" alt="" />MSAuth</div>
					<h1 className="login-title">{t("Sign in to your identity console.")}</h1>
					<p className="auth-sub">{t("A quiet ledger for identity.")}</p>
					<label className="field">
						<span>{t("Email")}</span>
						<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
					</label>
					<label className="field">
						<span>{t("Password")}</span>
						<input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
					</label>
					<Button kind="primary" className="block" type="submit" busy={busy} disabled={!email || !password}>{t("Sign in")}</Button>
					<div className="divider">{t("or")}</div>
					<button className="btn block" type="button" disabled={busy} onClick={() => void signInGithub()}>
						<img src="/github.svg" alt="" width={16} height={16} /> {t("Continue with GitHub")}
					</button>
					{error && <p className="error-note" role="alert">{error}</p>}
				</form>
			</div>
		</div>
	);
}
