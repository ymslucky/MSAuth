import { useState } from "react";
import { post } from "../api";
import { oauthQueryFromLocation } from "../oauthQuery";
import { useT } from "../i18n";
import { CopyButton } from "../ui";
import { projectSphere } from "../echo";

interface RequestInfo {
	clientId: string;
	scopes: string[];
	resource: string;
}

function readRequest(): RequestInfo {
	const params = new URLSearchParams(window.location.search);
	return {
		clientId: params.get("client_id") ?? "unknown client",
		scopes: (params.get("scope") ?? "").split(" ").filter(Boolean),
		resource: params.get("resource") ?? "",
	};
}

/**
 * Static echo of the login stage's identity constellation: the same
 * Fibonacci-sphere geometry (echo.ts projects it with the scene's settled
 * attitude) as one quiet SVG. No three.js, no animation — the authorization
 * moment carries the brand DNA at zero bundle cost, and a static drawing
 * satisfies prefers-reduced-motion by construction.
 */
function ConsentEcho() {
	const points = projectSphere(150, 9, 190);
	const ring = 89 * Math.cos(0.32);
	return (
		<svg className="consent-echo" viewBox="0 0 190 190" width={190} height={190} aria-hidden="true" focusable="false">
			<ellipse cx="95" cy="95" rx="89" ry={ring} />
			{points.map((point, index) => (
				<circle
					key={index}
					cx={point.x}
					cy={point.y}
					r={point.accent ? 2 : 1.1}
					className={point.accent ? "echo-accent" : "echo-ink"}
				/>
			))}
		</svg>
	);
}

export default function Consent() {
	const t = useT();
	const [request] = useState(readRequest);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function decide(accept: boolean) {
		setBusy(true);
		setError(null);
		try {
			const result = await post<{ redirect_uri?: string; url?: string; error?: string }>("/api/auth/oauth2/consent", {
				accept,
				oauth_query: oauthQueryFromLocation(window.location.search),
			});
			const target = accept ? result.redirect_uri ?? result.url : result.redirect_uri ?? result.url;
			if (!target) throw new Error(result.error ?? t("Consent response did not include a redirect"));
			window.location.href = target;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	return (
		<div className="auth-shell">
			<div className="auth-card">
				<ConsentEcho />
				<div className="brand"><img src="/favicon.svg" alt="" />MSAuth</div>
				<h1 className="login-title">{t("Authorize application")}</h1>
				<p className="auth-sub">
					<code>{request.clientId}</code>{" "}
					{t("is requesting access to your identity.")}
				</p>
				{request.resource && (
					<p className="muted">
						{t("Resource:")} <code>{request.resource}</code>{" "}
						<CopyButton value={request.resource} />
					</p>
				)}
				<div className="scope-box">
					<strong>{t("Requested scopes")}</strong>
					<div className="checks">
						{request.scopes.length === 0 && <span className="muted">{t("No scopes requested")}</span>}
						{request.scopes.map(scope => (
							<label key={scope}>
								<code>{scope}</code>
							</label>
						))}
					</div>
				</div>
				<div className="btn-row">
					<button className="btn primary" type="button" disabled={busy} onClick={() => void decide(true)}>
						{t("Allow")}
					</button>
					<button className="btn" type="button" disabled={busy} onClick={() => void decide(false)}>
						{t("Deny")}
					</button>
				</div>
				{error && <p className="error-note" role="alert">{error}</p>}
			</div>
		</div>
	);
}
