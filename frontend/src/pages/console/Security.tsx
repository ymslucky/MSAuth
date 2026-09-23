import { useEffect, useState } from "react";
import { api, del, fmtDate, post } from "../../api";
import { useT } from "../../i18n";
import { Badge, Button, Card, Empty, ErrorNote, Field, Table } from "../../ui";

interface AuditRow {
	id: string;
	actorId: string;
	action: string;
	resourceType: string;
	resourceId: string;
	detail: string;
	createdAt: number;
}

export function Audit(props: { operator: boolean }) {
	const t = useT();
	const [items, setItems] = useState<AuditRow[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [actor, setActor] = useState("");
	const [resource, setResource] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const query = new URLSearchParams({ page: String(page), ...(actor.trim() ? { actor: actor.trim() } : {}), ...(resource.trim() ? { resource: resource.trim() } : {}) });
		api<{ items: AuditRow[]; total: number }>(`/api/v1/audit?${query}`)
			.then(result => { setItems(result.items ?? []); setTotal(result.total ?? 0); })
			.catch(cause => setError(String(cause.message)));
	}, [page, actor, resource]);

	const pages = Math.max(1, Math.ceil(total / 30));
	return (
		<>
			<div className="main-head">
				<div>
					<h1>{t("Audit log")}</h1>
					<p>{props.operator ? t("Every mutation on the platform, filterable by actor or resource.") : t("Every mutation you performed.")}</p>
				</div>
			</div>
			<Card>
				<div className="field-row">
					{props.operator && (
						<Field label={t("Actor user ID")}><input value={actor} onChange={event => { setPage(1); setActor(event.target.value); }} spellCheck={false} /></Field>
					)}
					<Field label={t("Resource type or ID")}><input value={resource} onChange={event => { setPage(1); setResource(event.target.value); }} spellCheck={false} /></Field>
				</div>
				<ErrorNote message={error} />
				{items.length === 0 ? <Empty>{t("Nothing recorded for this filter.")}</Empty> : (
					<Table head={[t("When"), t("Actor"), t("Action"), t("Resource"), t("Detail")]}>
						{items.map(row => (
							<tr key={row.id}>
								<td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(row.createdAt)}</td>
								<td className="mono muted">{row.actorId.slice(0, 8)}…</td>
								<td><code>{row.action}</code></td>
								<td>{row.resourceType} <span className="mono muted">{row.resourceId.slice(0, 8)}</span></td>
								<td className="mono muted">{row.detail === "{}" ? "" : row.detail.slice(0, 120)}</td>
							</tr>
						))}
					</Table>
				)}
				{pages > 1 && (
					<div className="btn-row" style={{ marginTop: 12 }}>
						<Button kind="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("← Prev")}</Button>
						<span className="muted">{page} / {pages}</span>
						<Button kind="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next →")}</Button>
					</div>
				)}
			</Card>
		</>
	);
}

interface SessionRow {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: number;
	expiresAt: number;
}

export function Sessions() {
	const t = useT();
	const [items, setItems] = useState<SessionRow[]>([]);
	const [currentId, setCurrentId] = useState("");
	const [error, setError] = useState<string | null>(null);

	const reload = () => api<{ items: SessionRow[]; currentId: string }>("/api/v1/sessions")
		.then(result => { setItems(result.items ?? []); setCurrentId(result.currentId ?? ""); })
		.catch(cause => setError(String(cause.message)));
	useEffect(() => { void reload(); }, []);

	async function revoke(id: string) {
		setError(null);
		try {
			await del(`/api/v1/sessions/${id}`);
			if (id === currentId) { window.location.href = "/login"; return; }
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}

	return (
		<>
			<div className="main-head">
				<div>
					<h1>{t("Sessions")}</h1>
					<p>{t("Active browser sessions on your account.")}</p>
				</div>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>{t("No sessions.")}</Empty> : (
					<Table head={[t("Created"), "IP", t("User agent"), t("Expires"), ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td className="muted">{fmtDate(row.createdAt)}</td>
								<td className="mono">{row.ipAddress ?? "—"}</td>
								<td className="muted">{(row.userAgent ?? "").slice(0, 60)}</td>
								<td className="muted">{fmtDate(row.expiresAt)}</td>
								<td>
									{row.id === currentId ? <Badge>{t("current")}</Badge> : (
										<Button kind="danger" onClick={() => { if (confirm(t("Revoke this session?"))) void revoke(row.id); }}>{t("Revoke")}</Button>
									)}
								</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
		</>
	);
}

interface AlertRow {
	id: string;
	kind: string;
	detail: string;
	acknowledgedAt: number | null;
	createdAt: number;
}

export function Alerts() {
	const t = useT();
	const [items, setItems] = useState<AlertRow[]>([]);
	const [error, setError] = useState<string | null>(null);

	const reload = () => api<{ items: AlertRow[] }>("/api/v1/alerts").then(result => setItems(result.items ?? [])).catch(cause => setError(String(cause.message)));
	useEffect(() => { void reload(); }, []);

	return (
		<>
			<div className="main-head">
				<div>
					<h1>{t("Security alerts")}</h1>
					<p>{t("Sign-in anomalies and token events for your account.")}</p>
				</div>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>{t("No alerts. Quiet is good.")}</Empty> : (
					<Table head={[t("When"), t("Kind"), t("Detail"), ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(row.createdAt)}</td>
								<td><code>{row.kind}</code></td>
								<td className="mono muted">{row.detail.slice(0, 140)}</td>
								<td>{row.acknowledgedAt ? <Badge tone="ok">{t("ack")}</Badge> : (
									<Button kind="ghost" onClick={() => void post(`/api/v1/alerts/${row.id}/acknowledge`).then(reload)}>{t("Acknowledge")}</Button>
								)}</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
		</>
	);
}
