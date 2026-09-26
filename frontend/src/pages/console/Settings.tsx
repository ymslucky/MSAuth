import { useEffect, useMemo, useState } from "react";
import { api, del, errorMessage, patch } from "../../api";
import { useT } from "../../i18n";
import { Badge, Button, Card, CopyButton, ErrorState, MonoId, PageHeader, SkeletonStats, Table, When } from "../../ui";
import { useNotice } from "../../notice-ui";
import { useTableState } from "../../table";

interface SettingsResponse {
	registrationEnabled: boolean;
	dcrEnabled: boolean;
	issuer: string;
}

/** A DCR-created OAuth client (userId IS NULL in oauthClient). */
interface RegistrationRow {
	clientId: string;
	name: string;
	createdAt: number;
	redirectUris: string;
	scopes: string;
	disabled: number | null;
	dpopBoundAccessTokens: number | null;
}

/** oauthClient columns arrive as JSON strings; tolerate arrays and garbage. */
function parseJsonList(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter(v => typeof v === "string");
	if (typeof value !== "string" || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter(v => typeof v === "string") : [];
	} catch {
		return [];
	}
}

export function Settings() {
	const t = useT();
	const notice = useNotice();
	const [data, setData] = useState<SettingsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [busy, setBusy] = useState(false);

	const reload = () => api<SettingsResponse>("/api/v1/settings")
		.then(result => { setData(result); setError(null); })
		.catch(cause => setError(errorMessage(cause)));
	useEffect(() => {
		void reload();
	}, [attempt]);

	async function toggle(key: "registrationEnabled" | "dcrEnabled", value: boolean) {
		setBusy(true);
		try {
			await patch("/api/v1/settings", { [key]: value });
			notice.toast("success", t("Settings saved."));
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setBusy(false);
		}
	}

	if (error && !data) return <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />;
	if (!data) return <><PageHeader title={t("Platform settings")} crumbs={[{ label: t("Admin") }, { label: t("Settings") }]} /><SkeletonStats count={2} /></>;
	return (
		<>
			<PageHeader
				title={t("Platform settings")}
				crumbs={[{ label: t("Admin") }, { label: t("Settings") }]}
				subtitle={<>{t("Issuer:")} <code>{data.issuer}</code> <CopyButton value={data.issuer} /></>}
			/>
			<div className="inner-cap">
				<Card title={t("Registration")}>
					<label className="check-row">
						<input type="checkbox" disabled={busy} checked={data.registrationEnabled} onChange={event => void toggle("registrationEnabled", event.target.checked)} />
						{t("Allow new users to sign up (GitHub). Allowlisted admins can always sign in.")}
					</label>
				</Card>
				<Card title={t("Dynamic client registration")}>
					<label className="check-row">
						<input type="checkbox" disabled={busy} checked={data.dcrEnabled} onChange={event => void toggle("dcrEnabled", event.target.checked)} />
						{t("Allow unauthenticated OAuth clients to self-register (RFC 7591) — required for MCP client auto-discovery.")}
					</label>
				</Card>
				<RegistrationsCard />
			</div>
		</>
	);
}

function RegistrationsCard() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<RegistrationRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [busyId, setBusyId] = useState<string | null>(null);
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: RegistrationRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

	const reload = () => api<{ items: RegistrationRow[] }>("/api/v1/registrations")
		.then(result => { setItems(result.items ?? []); setError(null); })
		.catch(cause => setError(errorMessage(cause)));
	useEffect(() => {
		void reload();
	}, [attempt]);

	async function revoke(row: RegistrationRow) {
		if (!(await notice.confirm({ title: t("Revoke this registration? The client loses access immediately."), confirmLabel: t("Revoke") }))) return;
		setBusyId(row.clientId);
		try {
			await del(`/api/v1/registrations/${encodeURIComponent(row.clientId)}`);
			notice.toast("success", t("Registration revoked."));
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setBusyId(null);
		}
	}

	return (
		<Card title={t("Dynamic client registrations")}>
			<p className="muted">{t("OAuth clients that self-registered via RFC 7591. Revoking disables the client immediately.")}</p>
			{items === null ? (error
				? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
				: <p className="muted">{t("Loading…")}</p>
			) : items.length === 0 ? (
				<p className="muted">{t("No self-registered clients.")}</p>
			) : (
				<Table caption={t("Dynamic client registrations")} head={[t("Client"), t("Redirect URIs"), t("Scopes"), t("Created"), t("Status"), ""]} rightCols={[5]}>
					{table.rows.map(row => (
						<tr key={row.clientId}>
							<td>{row.name}<div className="cell-sub"><MonoId value={row.clientId} wide mask={false} /></div></td>
							<td className="mono">{parseJsonList(row.redirectUris).join(", ") || "—"}</td>
							<td className="mono">{parseJsonList(row.scopes).join(", ") || "—"}{row.dpopBoundAccessTokens ? <div className="cell-sub">DPoP</div> : null}</td>
							<td className="muted"><When value={row.createdAt} /></td>
							<td>{row.disabled ? <Badge tone="bad">{t("disabled")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}</td>
							<td className="right">
								{!row.disabled && (
									<Button kind="danger" busy={busyId === row.clientId} onClick={() => void revoke(row)}>{t("Revoke")}</Button>
								)}
							</td>
						</tr>
					))}
				</Table>
			)}
		</Card>
	);
}
