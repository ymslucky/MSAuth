import { useState } from "react";
import { post } from "../api";
import { oauthQueryFromLocation } from "../oauthQuery";

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

export default function Consent() {
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
			if (!target) throw new Error(result.error ?? "Consent response did not include a redirect");
			window.location.href = target;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setBusy(false);
		}
	}

	return (
		<div className="auth-shell">
			<div className="auth-card">
				<h1>Authorize application</h1>
				<p className="auth-sub">
					<code>{request.clientId}</code> is requesting access to your identity.
				</p>
				{request.resource && (
					<p className="muted">
						Resource: <code>{request.resource}</code>
					</p>
				)}
				<div className="scope-box">
					<strong style={{ fontSize: "0.85rem" }}>Requested scopes</strong>
					<div className="checks">
						{request.scopes.length === 0 && <span className="muted">No scopes requested</span>}
						{request.scopes.map(scope => (
							<label key={scope}>
								<code>{scope}</code>
							</label>
						))}
					</div>
				</div>
				<div className="btn-row">
					<button className="btn primary" type="button" disabled={busy} onClick={() => void decide(true)}>
						Allow
					</button>
					<button className="btn danger" type="button" disabled={busy} onClick={() => void decide(false)}>
						Deny
					</button>
				</div>
				{error && <p className="error-note" role="alert">{error}</p>}
			</div>
		</div>
	);
}
