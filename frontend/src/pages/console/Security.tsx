import { useEffect, useState } from "react";
import { api, del, fmtDate, fullTimestamp, post, summarizeAuditDetail } from "../../api";
import { useT } from "../../i18n";
import {
	Badge, Button, Card, Empty, ErrorNote, ErrorState, Field,
	MonoId, PageHeader, SkeletonTable, Table, useNotice,
} from "../../ui";

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
	const [loading, setLoading] = useState(true);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		setLoading(true);
		const query = new URLSearchParams({ page: String(page), ...(actor.trim() ? { actor: actor.trim() } : {}), ...(resource.trim() ? { resource: resource.trim() } : {}) });
		api<{ items: AuditRow[]; total: number }>(`/api/v1/audit?${query}`)
			.then(result => { setItems(result.items ?? []); setTotal(result.total ?? 0); setError(null); })
			.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setLoading(false));
	}, [page, actor, resource, attempt]);

	const pages = Math.max(1, Math.ceil(total / 30));
	return (
		<>
			<PageHeader
				title={t("Audit log")}
				subtitle={props.operator ? t("Every mutation on the platform, filterable by actor or resource.") : t("Every mutation you performed.")}
				crumbs={[{ label: t("Security") }, { label: t("Audit log") }]}
			/>
			{error && !loading
				? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
				: (
					<Card>
						<div className="field-row">
							{props.operator && (
								<Field label={t("Actor user ID")}><input value={actor} onChange={event => { setPage(1); setActor(event.target.value); }} spellCheck={false} /></Field>
							)}
							<Field label={t("Resource type or ID")}><input value={resource} onChange={event => { setPage(1); setResource(event.target.value); }} spellCheck={false} /></Field>
						</div>
						{loading ? <SkeletonTable /> : items.length === 0 ? (
							<Empty glyph="¶">{t("Nothing recorded for this filter.")}</Empty>
						) : (
							<>
								<Table className="audit-table" head={[t("When"), t("Actor"), t("Action"), t("Resource"), t("Detail")]}>
									{items.map(row => {
										const summary = summarizeAuditDetail(row.detail);
										return (
											<tr key={row.id}>
												<td className="col-when"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
												<td><MonoId value={row.actorId} /></td>
												<td className="col-action"><Badge>{row.action}</Badge></td>
												<td className="col-resource">
													<span className="cell-res" title={`${row.resourceType} ${row.resourceId}`}>
														<span className="res-type">{row.resourceType}</span>
														<MonoId value={row.resourceId} />
													</span>
												</td>
												<td className="col-detail" title={row.detail !== "{}" ? row.detail : undefined}>
													{summary || <span className="muted">—</span>}
												</td>
											</tr>
										);
									})}
								</Table>
								{pages > 1 && (
									<div className="btn-row" style={{ marginTop: 14 }}>
										<Button kind="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("← Prev")}</Button>
										<span className="muted mono">{page} / {pages}</span>
										<Button kind="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next →")}</Button>
									</div>
								)}
							</>
						)}
					</Card>
				)}
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
	const notice = useNotice();
	const [items, setItems] = useState<SessionRow[] | null>(null);
	const [currentId, setCurrentId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [revoking, setRevoking] = useState(false);

	const reload = () => api<{ items: SessionRow[]; currentId: string }>("/api/v1/sessions")
		.then(result => { setItems(result.items ?? []); setCurrentId(result.currentId ?? ""); setError(null); })
		.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
	}, [attempt]);

	async function revoke(id: string) {
		setError(null);
		if (!(await notice.confirm({ title: t("Revoke this session?"), confirmLabel: t("Revoke") }))) return;
		setRevoking(true);
		try {
			await del(`/api/v1/sessions/${id}`);
			if (id === currentId) { window.location.href = "/login"; return; }
			notice.toast("success", t("Session revoked."));
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setRevoking(false);
		}
	}

	return (
		<>
			<PageHeader
				title={t("Sessions")}
				subtitle={t("Active browser sessions on your account.")}
				crumbs={[{ label: t("Security") }, { label: t("Sessions") }]}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<Empty glyph="…">{t("No sessions.")}</Empty>
				) : (
					<Table head={[t("Created"), "IP", t("User agent"), t("Expires"), ""]} rightCols={[4]}>
						{items.map(row => (
							<tr key={row.id}>
								<td className="muted"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
								<td><MonoId value={row.ipAddress ?? "—"} /></td>
								<td className="muted"><span title={row.userAgent ?? ""}>{(row.userAgent ?? "").slice(0, 60)}</span></td>
								<td className="muted"><time title={fullTimestamp(row.expiresAt)}>{fmtDate(row.expiresAt)}</time></td>
								<td className="right">
									{row.id === currentId ? <Badge>{t("current")}</Badge> : (
										<Button kind="danger" disabled={revoking} onClick={() => void revoke(row.id)}>{t("Revoke")}</Button>
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
	const notice = useNotice();
	const [items, setItems] = useState<AlertRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [acking, setAcking] = useState<string | null>(null);

	const reload = () => api<{ items: AlertRow[] }>("/api/v1/alerts")
		.then(result => { setItems(result.items ?? []); setError(null); })
		.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
	}, [attempt]);

	function acknowledge(id: string) {
		setAcking(id);
		void post(`/api/v1/alerts/${id}/acknowledge`)
			.then(() => { notice.toast("success", t("Alert acknowledged.")); return reload(); })
			.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)))
			.finally(() => setAcking(null));
	}

	return (
		<>
			<PageHeader
				title={t("Security alerts")}
				subtitle={t("Sign-in anomalies and token events for your account.")}
				crumbs={[{ label: t("Security") }, { label: t("Alerts") }]}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			{items === null && error
				? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
				: (
					<Card>
						{items === null ? <SkeletonTable /> : items.length === 0 ? (
							<Empty glyph="!">{t("No alerts. Quiet is good.")}</Empty>
						) : (
							<Table head={[t("When"), t("Kind"), t("Detail"), ""]} rightCols={[3]}>
								{items.map(row => (
									<tr key={row.id}>
										<td className="muted" style={{ whiteSpace: "nowrap" }}><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
										<td><code>{row.kind}</code></td>
										<td className="mono muted"><span title={row.detail}>{row.detail.slice(0, 140)}</span></td>
										<td className="right">
											{row.acknowledgedAt ? <Badge tone="ok">{t("ack")}</Badge> : (
												<Button kind="ghost" disabled={acking === row.id} onClick={() => acknowledge(row.id)}>{t("Acknowledge")}</Button>
											)}
										</td>
									</tr>
								))}
							</Table>
						)}
					</Card>
				)}
		</>
	);
}
