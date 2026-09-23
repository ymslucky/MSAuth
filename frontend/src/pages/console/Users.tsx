import { useEffect, useMemo, useState } from "react";
import { Ban, Users as UsersIcon } from "lucide-react";
import { api, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { useOptimisticList } from "../../optimistic";
import { toggledSet, useTableState } from "../../table";
import { navigate } from "../../router";
import {
	Badge, Button, Card, EmptyState, ErrorNote, ErrorState, Field, FilterChips,
	MonoId, PageHeader, SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { Modal } from "../../dialog";
import { useNotice } from "../../notice-ui";
import { usePaletteSource, type PaletteEntry } from "../../palette-ui";

interface UserRow {
	id: string;
	name: string;
	email: string;
	emailVerified: number | null;
	banned: boolean | null;
	twoFactorEnabled: boolean | null;
	createdAt: number;
}

const USERS_PAGE_SIZE = 30;

export function Users() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<UserRow[] | null>(null);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState<ReadonlySet<string>>(new Set());
	const [error, setError] = useState<string | null>(null);
	const [banTarget, setBanTarget] = useState<UserRow | null>(null);
	const [banReason, setBanReason] = useState("");
	const [banBusy, setBanBusy] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const optimistic = useOptimisticList<UserRow>(items, setItems);

	const reload = () => {
		const params = new URLSearchParams({ page: String(page), ...(query.trim() ? { q: query.trim() } : {}) });
		return api<{ items: UserRow[]; total?: number }>(`/api/v1/users?${params}`)
			.then(result => { setItems(result.items ?? []); setTotal(result.total ?? result.items?.length ?? 0); setError(null); })
			.catch(cause => setError(errorMessage(cause)));
	};
	useEffect(() => {
		setItems(null);
		void reload();
	}, [page, query]);

	// Non-destructive: optimistic badge flip; failure rolls back + toasts.
	function unsuspend(row: UserRow) {
		setPendingId(row.id);
		void optimistic.run(
			list => list.map(item => item.id === row.id ? { ...item, banned: false } : item),
			() => post(`/api/v1/users/${row.id}/unban`),
		)
			.then(() => notice.toast("success", t("User unsuspended.")))
			.catch(cause => notice.toast("error", errorMessage(cause)))
			.finally(() => setPendingId(null));
	}

	// Destructive: confirmed via the reason modal, then the same optimistic path.
	function suspend(row: UserRow, reason: string) {
		setPendingId(row.id);
		return optimistic.run(
			list => list.map(item => item.id === row.id ? { ...item, banned: true } : item),
			() => post(`/api/v1/users/${row.id}/ban`, { reason }),
		)
			.then(() => notice.toast("success", t("User suspended.")))
			.catch(cause => notice.toast("error", errorMessage(cause)))
			.finally(() => setPendingId(null));
	}

	const accessors = useMemo(() => ({
		name: (row: UserRow) => row.name,
		emailVerified: (row: UserRow) => row.emailVerified ?? 0,
		twoFactorEnabled: (row: UserRow) => (row.twoFactorEnabled ? 1 : 0),
		createdAt: (row: UserRow) => row.createdAt,
		banned: (row: UserRow) => (row.banned ? 1 : 0),
	}), []);
	const filterKey = `${query}|${page}|${[...status].sort().join(",")}`;
	const table = useTableState(items ?? [], {
		accessors,
		// Server pages at 30; the hook owns sort + status chips within the page.
		pageSize: USERS_PAGE_SIZE * 10,
		initialSort: { key: "createdAt", dir: "desc" },
		active: status,
		match: (row, key) => key === "suspended" ? Boolean(row.banned) : !row.banned,
		filterKey,
	});
	const statusChips = useMemo(() => [
		{ key: "active", label: t("active") },
		{ key: "suspended", label: t("suspended") },
	], [t]);
	const toggleStatus = (key: string) => setStatus(current => toggledSet(current, key));

	// Palette: search loaded users by name / email / id → user detail.
	const paletteEntries = useMemo<PaletteEntry[] | null>(() => items === null ? null : items.map(row => ({
		id: `user:${row.id}`,
		group: "resource",
		label: row.name || row.email,
		keywords: `${row.name} ${row.email} ${row.id}`,
		icon: <UsersIcon size={15} strokeWidth={1.75} aria-hidden />,
		perform: () => navigate(`/users/${encodeURIComponent(row.id)}`),
	})), [items]);
	usePaletteSource("users", paletteEntries);

	const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
	return (
		<>
			<PageHeader
				title={t("Users")}
				subtitle={t("Platform identities. Suspension revokes agents, delegations, clients and keys.")}
				crumbs={[{ label: t("Admin") }, { label: t("Users") }]}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				<Field label={t("Search email or name")}>
					<input value={query} onChange={event => { setPage(1); setQuery(event.target.value); }} spellCheck={false} />
				</Field>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => void reload()} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<EmptyState art="search" title={t("No matching users.")} />
				) : (
					<>
						<FilterChips ariaLabel={t("Filter by status")} chips={statusChips} active={status} onToggle={toggleStatus} />
						<Table
							caption={t("Users")}
							sort={{ spec: table.sort, onToggle: table.toggleSort }}
							rightCols={[5]}
							head={[
								{ label: t("User"), sortKey: "name" },
								{ label: t("Verified"), sortKey: "emailVerified" },
								{ label: t("2FA"), sortKey: "twoFactorEnabled" },
								{ label: t("Created"), sortKey: "createdAt" },
								{ label: t("Status"), sortKey: "banned" },
								"",
							]}
						>
							{table.rows.map(row => (
								<tr key={row.id}>
									<td>{row.name}<div className="cell-sub">{row.email}</div></td>
									<td>{row.emailVerified ? <Badge tone="ok">{t("yes")}</Badge> : <Badge tone="warn">{t("no")}</Badge>}</td>
									<td>{row.twoFactorEnabled ? <Badge>{t("on")}</Badge> : <span className="muted">{t("off")}</span>}</td>
									<td className="muted"><When value={row.createdAt} /></td>
									<td>{row.banned ? <Badge tone="bad">{t("suspended")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}</td>
									<td className="right">
										<div className="btn-row">
											<Button kind="ghost" disabled={pendingId === row.id} onClick={() => navigate(`/users/${encodeURIComponent(row.id)}`)}>{t("Detail")}</Button>
											{row.banned ? (
												<Button kind="ghost" busy={pendingId === row.id} onClick={() => unsuspend(row)}>{t("Unsuspend")}</Button>
											) : (
												<Button kind="danger" disabled={pendingId === row.id} onClick={() => { setBanTarget(row); setBanReason(""); }}><Ban size={14} strokeWidth={1.75} aria-hidden />{t("Suspend")}</Button>
											)}
										</div>
									</td>
								</tr>
							))}
						</Table>
						{pages > 1 && (
							<TablePager
								page={page}
								pages={pages}
								start={(page - 1) * USERS_PAGE_SIZE + 1}
								end={(page - 1) * USERS_PAGE_SIZE + items.length}
								total={total}
								onPage={setPage}
							/>
						)}
					</>
				)}
			</Card>
			{banTarget && (
				<Modal title={t("Suspend user")} open onClose={() => setBanTarget(null)}>
					<p className="confirm-body">{t("Suspending revokes this user's agents, delegations, clients and keys.")}</p>
					<Field label={t("Suspension reason?")}>
						<input value={banReason} onChange={event => setBanReason(event.target.value)} maxLength={200} />
					</Field>
					<div className="btn-row">
						<Button
							kind="danger-solid"
							busy={banBusy}
							disabled={!banReason.trim()}
							onClick={() => {
								setBanBusy(true);
								void suspend(banTarget, banReason.trim()).finally(() => {
									setBanBusy(false);
									setBanTarget(null);
								});
							}}
						>{t("Suspend")}</Button>
						<Button kind="ghost" disabled={banBusy} onClick={() => setBanTarget(null)}>{t("Cancel")}</Button>
					</div>
				</Modal>
			)}
		</>
	);
}
