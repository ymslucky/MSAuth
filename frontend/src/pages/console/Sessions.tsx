import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { api, del, errorMessage } from "../../api";
import { useT } from "../../i18n";
import { useOptimisticList } from "../../optimistic";
import { useTableState } from "../../table";
import {
	Badge, Button, Card, EmptyState, ErrorNote, ErrorState, MonoId, PageHeader,
	SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { useNotice } from "../../notice-ui";

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
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const optimistic = useOptimisticList<SessionRow>(items, setItems);
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: SessionRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

	const reload = () => api<{ items: SessionRow[]; currentId: string }>("/api/v1/sessions")
		.then(result => { setItems(result.items ?? []); setCurrentId(result.currentId ?? ""); setError(null); })
		.catch(cause => setError(errorMessage(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
	}, [attempt]);

	async function revoke(id: string) {
		if (!(await notice.confirm({ title: t("Revoke this session?"), confirmLabel: t("Revoke") }))) return;
		// Optimistic: the row drops immediately; failure rolls back + toasts.
		setRevokingId(id);
		try {
			await optimistic.run(
				list => list.filter(row => row.id !== id),
				() => del(`/api/v1/sessions/${id}`),
			);
			if (id === currentId) { window.location.href = "/login"; return; }
			notice.toast("success", t("Session revoked."));
			void reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setRevokingId(null);
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
						<Table caption={t("Sessions")} head={[t("Created"), "IP", t("User agent"), t("Expires"), ""]} rightCols={[4]}>
							{table.rows.map(row => (
								<tr key={row.id}>
									<td className="muted"><When value={row.createdAt} /></td>
									<td><MonoId value={row.ipAddress ?? "—"} mask={false} /></td>
									<td className="muted"><span title={row.userAgent ?? ""}>{(row.userAgent ?? "").slice(0, 60)}</span></td>
									<td className="muted"><When value={row.expiresAt} /></td>
									<td className="right">
										{row.id === currentId ? <Badge>{t("current")}</Badge> : (
											<Button
												kind="danger"
												busy={revokingId === row.id}
												disabled={revokingId !== null && revokingId !== row.id}
												onClick={() => void revoke(row.id)}
											><ShieldOff size={14} strokeWidth={1.75} aria-hidden />{t("Revoke")}</Button>
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
