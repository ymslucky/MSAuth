import { useEffect, useState } from "react";
import { api, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { useTableState } from "../../table";
import {
	Badge, Button, Card, EmptyState, ErrorState, Field, MonoId,
	PageHeader, SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { useNotice } from "../../notice-ui";

interface DomainRow {
	id: string;
	hostname: string;
	challenge: string;
	verifiedAt: number | null;
	createdAt: number;
}

export function Domains() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<DomainRow[] | null>(null);
	const [hostname, setHostname] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [busy, setBusy] = useState(false);
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: DomainRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

	const reload = () => api<{ items: DomainRow[] }>("/api/v1/domains")
		.then(result => { setItems(result.items ?? []); setError(null); })
		.catch(cause => setError(errorMessage(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
	}, [attempt]);

	async function run(action: () => Promise<unknown>, successMessage?: string) {
		try {
			await action();
			if (successMessage) notice.toast("success", successMessage);
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		}
	}

	return (
		<>
			<PageHeader
				title={t("Domains")}
				subtitle={t("Prove ownership of the domains your resources run on.")}
				crumbs={[{ label: t("Admin") }, { label: t("Domains") }]}
			/>
			<Card title={t("Add domain")}>
				<div className="field-row inner-cap">
					<Field label={t("Hostname")}><input value={hostname} onChange={event => setHostname(event.target.value)} placeholder="example.com" spellCheck={false} /></Field>
				</div>
				<Button kind="primary" busy={busy} disabled={!hostname.trim()} onClick={() => {
					setBusy(true);
					void run(async () => {
						await post("/api/v1/domains", { hostname: hostname.trim() });
						setHostname("");
					}, t("Domain added.")).finally(() => setBusy(false));
				}}>{t("Add")}</Button>
			</Card>
			<Card title={t("Your domains")}>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<EmptyState art="applications" title={t("No domains added.")} />
				) : (
					<>
					<Table caption={t("Your domains")} head={[t("Hostname"), t("TXT record"), t("Value"), t("Status"), t("Created"), ""]} rightCols={[5]}>
						{table.rows.map(row => (
							<tr key={row.id}>
								<td>{row.hostname}</td>
								<td><MonoId value={`_msauth.${row.hostname}`} mask={false} /></td>
								<td><MonoId value={row.challenge} wide /></td>
								<td>{row.verifiedAt ? <Badge tone="ok">{t("verified")}</Badge> : <Badge tone="warn">{t("pending")}</Badge>}</td>
								<td className="muted"><When value={row.createdAt} /></td>
								<td className="right">
									{!row.verifiedAt && (
										<Button kind="ghost" busy={busy} onClick={() => void run(() => post(`/api/v1/domains/${row.id}/verify`), t("Domain verified."))}>{t("Verify")}</Button>
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
