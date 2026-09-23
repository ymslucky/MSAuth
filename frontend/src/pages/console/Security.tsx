import { useEffect, useMemo, useState } from "react";
import { ShieldOff } from "lucide-react";
import { api, del, fmtDate, fullTimestamp, post, summarizeAuditDetail } from "../../api";
import { useT } from "../../i18n";
import { useTableState } from "../../table";
import {
	ActionTag, Badge, Button, Card, EmptyState, ErrorNote, ErrorState, Field, FilterChips,
	MonoId, PageHeader, RESOURCE_TONES, ResourceTag, resourceTone, SkeletonTable, Table,
	TablePager, useNotice,
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

const AUDIT_PAGE_SIZE = 30;

export function Audit(props: { operator: boolean }) {
	const t = useT();
	const [items, setItems] = useState<AuditRow[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [actor, setActor] = useState("");
	const [resource, setResource] = useState("");
	const [types, setTypes] = useState<ReadonlySet<string>>(new Set());
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

	const accessors = useMemo(() => ({
		createdAt: (row: AuditRow) => row.createdAt,
		actorId: (row: AuditRow) => row.actorId,
		action: (row: AuditRow) => row.action,
		resourceType: (row: AuditRow) => row.resourceType,
	}), []);
	const filterKey = `${actor}|${resource}|${page}|${[...types].sort().join(",")}`;
	const table = useTableState(items, {
		accessors,
		// Server pages at 30; the hook owns sort + type chips within the page.
		pageSize: AUDIT_PAGE_SIZE * 10,
		initialSort: { key: "createdAt", dir: "desc" },
		active: types,
		match: (row, key) => row.resourceType === key,
		filterKey,
	});

	const typeChips = useMemo(() => {
		const present = [...new Set(items.map(row => row.resourceType))];
		const rank = (type: string) => RESOURCE_TONES.indexOf(resourceTone(type));
		return present.sort((a, b) => rank(a) - rank(b)).map(type => ({ key: type, label: type, tone: resourceTone(type) }));
	}, [items]);
	const toggleType = (key: string) => setTypes(current => {
		const next = new Set(current);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});

	const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
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
							<EmptyState art="search" title={t("Nothing recorded for this filter.")} />
						) : (
							<>
								{typeChips.length > 1 && (
									<FilterChips ariaLabel={t("Filter by type")} chips={typeChips} active={types} onToggle={toggleType} />
								)}
								<Table
									className="audit-table"
									sort={{ spec: table.sort, onToggle: table.toggleSort }}
									head={[
										{ label: t("When"), sortKey: "createdAt" },
										{ label: t("Actor"), sortKey: "actorId" },
										{ label: t("Action"), sortKey: "action" },
										{ label: t("Resource"), sortKey: "resourceType" },
										t("Detail"),
									]}
								>
									{table.rows.map(row => {
										const summary = summarizeAuditDetail(row.detail);
										return (
											<tr key={row.id}>
												<td className="col-when"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
												<td><MonoId value={row.actorId} /></td>
												<td className="col-action"><ActionTag code={row.action} /></td>
												<td className="col-resource">
													<span className="cell-res" title={`${row.resourceType} ${row.resourceId}`}>
														<ResourceTag type={row.resourceType} />
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
									<TablePager
										page={page}
										pages={pages}
										start={(page - 1) * AUDIT_PAGE_SIZE + 1}
										end={(page - 1) * AUDIT_PAGE_SIZE + items.length}
										total={total}
										onPage={setPage}
									/>
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
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: SessionRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

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
					<EmptyState art="users" title={t("No sessions.")} />
				) : (
					<>
						<Table head={[t("Created"), "IP", t("User agent"), t("Expires"), ""]} rightCols={[4]}>
							{table.rows.map(row => (
								<tr key={row.id}>
									<td className="muted"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
									<td><MonoId value={row.ipAddress ?? "—"} mask={false} /></td>
									<td className="muted"><span title={row.userAgent ?? ""}>{(row.userAgent ?? "").slice(0, 60)}</span></td>
									<td className="muted"><time title={fullTimestamp(row.expiresAt)}>{fmtDate(row.expiresAt)}</time></td>
									<td className="right">
										{row.id === currentId ? <Badge>{t("current")}</Badge> : (
											<Button kind="danger" disabled={revoking} onClick={() => void revoke(row.id)}><ShieldOff size={14} strokeWidth={1.75} aria-hidden />{t("Revoke")}</Button>
										)}
									</td>
								</tr>
							))}
						</Table>
						{table.pages > 1 && (
							<TablePager
								page={table.page}
								pages={table.pages}
								start={table.start}
								end={table.end}
								total={table.total}
								onPage={table.setPage}
							/>
						)}
					</>
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
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: AlertRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

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
							<EmptyState art="audit" title={t("No alerts. Quiet is good.")} />
						) : (
							<>
								<Table head={[t("When"), t("Kind"), t("Detail"), ""]} rightCols={[3]}>
									{table.rows.map(row => (
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
								{table.pages > 1 && (
									<TablePager
										page={table.page}
										pages={table.pages}
										start={table.start}
										end={table.end}
										total={table.total}
										onPage={table.setPage}
									/>
								)}
							</>
						)}
					</Card>
				)}
		</>
	);
}
