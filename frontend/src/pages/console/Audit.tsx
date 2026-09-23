import { useEffect, useMemo, useState } from "react";
import { api, errorMessage, summarizeAuditDetail } from "../../api";
import { useT } from "../../i18n";
import { toggledSet, useTableState } from "../../table";
import {
	ActionTag, Card, EmptyState, ErrorNote, ErrorState, Field, FilterChips,
	MonoId, PageHeader, RESOURCE_TONES, ResourceTag, resourceTone, SkeletonTable,
	Table, TablePager, When,
} from "../../ui";

interface AuditRow {
	id: string;
	actorId: string;
	actorEmail?: string | null;
	actorName?: string | null;
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
			.catch(cause => setError(errorMessage(cause)))
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
	const toggleType = (key: string) => setTypes(current => toggledSet(current, key));

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
								<Field label={t("Actor email or ID")}><input value={actor} onChange={event => { setPage(1); setActor(event.target.value); }} spellCheck={false} /></Field>
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
									caption={t("Audit log")}
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
												<td className="col-when"><When value={row.createdAt} /></td>
												<td>{row.actorEmail
													? <span title={`${row.actorName ?? ""} ${row.actorId}`.trim()}>{row.actorEmail}</span>
													: <MonoId value={row.actorId} />}</td>
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
