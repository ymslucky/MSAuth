import { useEffect, useState } from "react";
import { api, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { useTableState } from "../../table";
import {
	Badge, Button, Card, EmptyState, ErrorNote, ErrorState, PageHeader,
	SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { useNotice } from "../../notice-ui";

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
		.catch(cause => setError(errorMessage(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
	}, [attempt]);

	function acknowledge(id: string) {
		setAcking(id);
		void post(`/api/v1/alerts/${id}/acknowledge`)
			.then(() => { notice.toast("success", t("Alert acknowledged.")); return reload(); })
			.catch(cause => setError(errorMessage(cause)))
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
								<Table caption={t("Security alerts")} head={[t("When"), t("Kind"), t("Detail"), ""]} rightCols={[3]}>
									{table.rows.map(row => (
										<tr key={row.id}>
											<td className="muted" style={{ whiteSpace: "nowrap" }}><When value={row.createdAt} /></td>
											<td><code>{row.kind}</code></td>
											<td className="mono muted"><span title={row.detail}>{row.detail.slice(0, 140)}</span></td>
											<td className="right">
												{row.acknowledgedAt ? <Badge tone="ok">{t("ack")}</Badge> : (
													<Button kind="ghost" busy={acking === row.id} onClick={() => acknowledge(row.id)}>{t("Acknowledge")}</Button>
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
