import { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { errorMessage, post } from "../api";
import { oauthQueryFromLocation } from "../oauthQuery";
import { LangSegmented, useT } from "../i18n";
import { ThemeToggle, scenePalette, useTheme } from "../theme";
import { Button } from "../ui";
import { Link } from "../router";
import { mountLoginScene } from "../scene";
import { authenticateWithPasskey, isPasskeySupported } from "../webauthn";

type TwoFactorMode = "totp" | "backup";

export default function Login() {
	const t = useT();
	const { resolved } = useTheme();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [stage, setStage] = useState<"credentials" | "twofactor">("credentials");
	const [twoFactorMode, setTwoFactorMode] = useState<TwoFactorMode>("totp");
	const [code, setCode] = useState("");
	const passkeySupported = isPasskeySupported();
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
			const result = await post<{ twoFactorRedirect?: boolean }>("/api/auth/sign-in/email", { email, password, oauth_query: oauthQueryFromLocation(window.location.search) });
			if (result.twoFactorRedirect) {
				setStage("twofactor");
				setTwoFactorMode("totp");
				setCode("");
				setBusy(false);
				return;
			}
			window.location.href = "/";
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	async function verifyTwoFactor() {
		setBusy(true);
		setError(null);
		try {
			// Either endpoint settles the challenge cookie into a real session.
			await post(twoFactorMode === "totp" ? "/api/auth/two-factor/verify-totp" : "/api/auth/two-factor/verify-backup-code", { code: code.trim() });
			window.location.href = "/";
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	async function signInPasskey() {
		setBusy(true);
		setError(null);
		try {
			await authenticateWithPasskey();
			window.location.href = "/";
		} catch (cause) {
			setError(errorMessage(cause));
			setBusy(false);
		}
	}

	function backToCredentials() {
		setStage("credentials");
		setCode("");
		setError(null);
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
						if (busy) return;
						if (stage === "twofactor") void verifyTwoFactor();
						else void signInEmail();
					}}
				>
					<div className="brand login-brand-compact"><img src="/favicon.svg" alt="" />MSAuth</div>
					<h1 className="login-title">{t("Sign in to your identity console.")}</h1>
					<p className="auth-sub">{t("A quiet ledger for identity.")}</p>
					{stage === "credentials" ? (
						<>
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
							{passkeySupported && (
								<button className="btn block" type="button" disabled={busy} onClick={() => void signInPasskey()}>
									<Fingerprint size={16} strokeWidth={2} aria-hidden /> {t("Sign in with a passkey")}
								</button>
							)}
							<button className="btn block" type="button" disabled={busy} onClick={() => void signInGithub()}>
								<img src="/github.svg" alt="" width={16} height={16} /> {t("Continue with GitHub")}
							</button>
						</>
					) : (
						<>
							<p className="auth-sub">{t("Two-factor authentication is on for this account.")}</p>
							<label className="field">
								<span>{twoFactorMode === "totp" ? t("Authenticator code") : t("Backup code")}</span>
								<input
									autoFocus
									inputMode={twoFactorMode === "totp" ? "numeric" : "text"}
									autoComplete="one-time-code"
									required
									value={code}
									onChange={event => setCode(event.target.value)}
								/>
							</label>
							<Button kind="primary" className="block" type="submit" busy={busy} disabled={!code.trim()}>{t("Verify")}</Button>
							<button className="btn block" type="button" disabled={busy} onClick={() => setTwoFactorMode(mode => mode === "totp" ? "backup" : "totp")}>
								{twoFactorMode === "totp" ? t("Use a backup code") : t("Use an authenticator code")}
							</button>
							<button className="btn block ghost" type="button" disabled={busy} onClick={backToCredentials}>{t("Back")}</button>
						</>
					)}
					{error && <p className="error-note" role="alert">{t(error)}</p>}
				</form>
				<p className="login-docs-row">
					<Link to="/docs" className="login-docs-link">{t("Integration guide")}</Link>
				</p>
			</div>
		</div>
	);
}
