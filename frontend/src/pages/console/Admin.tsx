import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Ban, Users as UsersIcon } from "lucide-react";
import { api, del, fmtDate, fullTimestamp, patch, post } from "../../api";
import { useT } from "../../i18n";
import { useTableState } from "../../table";
import { navigate } from "../../router";
import {
	Badge, Button, Card, CopyButton, EmptyState, ErrorNote, ErrorState, Field, FilterChips,
	Modal, MonoId, PageHeader, SkeletonProfile, SkeletonTable, SkeletonStats, Table,
	TablePager, useNotice, usePaletteSource, type PaletteEntry,
} from "../../ui";

interface UserRow {
	id: string;
	name: string;
	email: string;
	emailVerified: number | null;
	banned: boolean | null;
	twoFactorEnabled: boolean | null;
	createdAt: number;
}

interface UserDetailData {
	user: UserRow;
	sessions: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: number; expiresAt: number }[];
	accounts: { id: string; providerId: string; accountId: string; createdAt: number }[];
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

	const reload = () => {
		const params = new URLSearchParams({ page: String(page), ...(query.trim() ? { q: query.trim() } : {}) });
		return api<{ items: UserRow[]; total?: number }>(`/api/v1/users?${params}`)
			.then(result => { setItems(result.items ?? []); setTotal(result.total ?? result.items?.length ?? 0); setError(null); })
			.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	};
	useEffect(() => {
		setItems(null);
		void reload();
	}, [page, query]);

	async function run(action: () => Promise<unknown>, successMessage?: string) {
		setError(null);
		try {
			await action();
			if (successMessage) notice.toast("success", successMessage);
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
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
	const toggleStatus = (key: string) => setStatus(current => {
		const next = new Set(current);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});

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
									<td className="muted"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
									<td>{row.banned ? <Badge tone="bad">{t("suspended")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}</td>
									<td className="right">
										<div className="btn-row">
											<Button kind="ghost" onClick={() => navigate(`/users/${encodeURIComponent(row.id)}`)}>{t("Detail")}</Button>
											{row.banned ? (
												<Button kind="ghost" onClick={() => void run(() => post(`/api/v1/users/${row.id}/unban`), t("User unsuspended."))}>{t("Unsuspend")}</Button>
											) : (
												<Button kind="danger" onClick={() => { setBanTarget(row); setBanReason(""); }}><Ban size={14} strokeWidth={1.75} aria-hidden />{t("Suspend")}</Button>
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
								void run(async () => {
									await post(`/api/v1/users/${banTarget.id}/ban`, { reason: banReason.trim() });
									notice.toast("success", t("User suspended."));
								}).finally(() => {
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

/** Full-page user detail (route `/users/:id`) — the old modal, uncramped. */
export function UserDetail(props: { id: string }) {
	const t = useT();
	const notice = useNotice();
	const [detail, setDetail] = useState<UserDetailData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [banOpen, setBanOpen] = useState(false);
	const [banReason, setBanReason] = useState("");
	const [banBusy, setBanBusy] = useState(false);
	const [busy, setBusy] = useState(false);

	const reload = useCallback(() => {
		return api<UserDetailData>(`/api/v1/users/${props.id}`)
			.then(result => { setDetail(result); setError(null); })
			.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	}, [props.id]);
	useEffect(() => {
		setDetail(null);
		void reload();
	}, [reload, attempt]);

	async function run(action: () => Promise<unknown>, successMessage: string) {
		setError(null);
		setBusy(true);
		try {
			await action();
			notice.toast("success", successMessage);
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setBusy(false);
		}
	}

	const user = detail?.user;
	return (
		<>
			<PageHeader
				title={user?.name ?? t("User detail")}
				subtitle={user?.email}
				crumbs={[{ label: t("Admin") }, { label: t("Users"), to: "/users" }, { label: user?.email ?? "…" }]}
				actions={user && <Button kind="ghost" onClick={() => navigate("/users")}><ArrowLeft size={14} strokeWidth={1.75} aria-hidden />{t("Back")}</Button>}
			/>
			<ErrorNote message={detail && error ? error : null} />
			{detail === null ? (error
				? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
				// Skeleton mirrors the final three-card geometry: profile grid + two tables.
				: <>
					<Card title={t("Profile")}><SkeletonProfile /></Card>
					<Card title={t("Sessions")}><SkeletonTable rows={3} /></Card>
					<Card title={t("Linked accounts")}><SkeletonTable rows={2} /></Card>
				</>
			) : (
				<>
					<Card title={t("Profile")}>
						<div className="profile-grid">
							<div>
								<span className="muted">{t("Email")}</span>
								<strong>{user?.email}</strong>
							</div>
							<div>
								<span className="muted">{t("User ID")}</span>
								<MonoId value={user?.id ?? ""} />
							</div>
							<div>
								<span className="muted">{t("Created")}</span>
								<strong><time title={fullTimestamp(user?.createdAt)}>{fmtDate(user?.createdAt)}</time></strong>
							</div>
							<div>
								<span className="muted">{t("Status")}</span>
								<span className="status-badges">
									{user?.banned
										? <Badge tone="bad">{t("suspended")}</Badge>
										: <Badge tone="ok">{t("active")}</Badge>}
									{user?.emailVerified ? <Badge tone="ok">{t("Verified")}</Badge> : <Badge tone="warn">{t("no")}</Badge>}
									{user?.twoFactorEnabled ? <Badge>{t("2FA")}</Badge> : null}
								</span>
							</div>
						</div>
						<div className="btn-row" style={{ marginTop: 16 }}>
							{user?.banned ? (
								<Button kind="ghost" disabled={busy} onClick={() => void run(() => post(`/api/v1/users/${user.id}/unban`), t("User unsuspended."))}>{t("Unsuspend")}</Button>
							) : (
								<Button kind="danger" disabled={busy} onClick={() => { setBanReason(""); setBanOpen(true); }}><Ban size={14} strokeWidth={1.75} aria-hidden />{t("Suspend")}</Button>
							)}
						</div>
						{user?.banned && <p className="cell-sub" style={{ marginTop: 10 }}>{t("Ban and revoke everything this user controls.")}</p>}
					</Card>
					<Card title={t("Sessions")}>
						{detail.sessions.length === 0 ? <EmptyState art="users" title={t("None.")} /> : (
							<Table head={[t("Created"), "IP", t("User agent"), t("Expires")]}>
								{detail.sessions.map(session => (
									<tr key={session.id}>
										<td className="muted"><time title={fullTimestamp(session.createdAt)}>{fmtDate(session.createdAt)}</time></td>
										<td><MonoId value={session.ipAddress ?? "—"} mask={false} /></td>
										<td className="muted"><span title={session.userAgent ?? ""}>{(session.userAgent ?? "").slice(0, 60)}</span></td>
										<td className="muted"><time title={fullTimestamp(session.expiresAt)}>{fmtDate(session.expiresAt)}</time></td>
									</tr>
								))}
							</Table>
						)}
					</Card>
					<Card title={t("Linked accounts")}>
						{detail.accounts.length === 0 ? <EmptyState art="audit" title={t("None.")} /> : (
							<Table head={[t("Provider"), t("Account ID"), t("Linked")]}>
								{detail.accounts.map(account => (
									<tr key={account.id}>
										<td><code>{account.providerId}</code></td>
										<td><MonoId value={account.accountId} /></td>
										<td className="muted"><time title={fullTimestamp(account.createdAt)}>{fmtDate(account.createdAt)}</time></td>
									</tr>
								))}
							</Table>
						)}
					</Card>
				</>
			)}
			{banOpen && user && (
				<Modal title={t("Suspend user")} open onClose={() => setBanOpen(false)}>
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
								void run(async () => {
									await post(`/api/v1/users/${user.id}/ban`, { reason: banReason.trim() });
								}, t("User suspended.")).finally(() => {
									setBanBusy(false);
									setBanOpen(false);
								});
							}}
						>{t("Suspend")}</Button>
						<Button kind="ghost" disabled={banBusy} onClick={() => setBanOpen(false)}>{t("Cancel")}</Button>
					</div>
				</Modal>
			)}
		</>
	);
}

interface SettingsResponse {
	registrationEnabled: boolean;
	dcrEnabled: boolean;
	issuer: string;
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
		.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	useEffect(() => {
		void reload();
	}, [attempt]);

	async function toggle(key: "registrationEnabled" | "dcrEnabled", value: boolean) {
		setError(null);
		setBusy(true);
		try {
			await patch("/api/v1/settings", { [key]: value });
			notice.toast("success", t("Settings saved."));
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
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
			<ErrorNote message={error} />
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
			</div>
		</>
	);
}

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
		.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
	}, [attempt]);

	async function run(action: () => Promise<unknown>, successMessage?: string) {
		setError(null);
		try {
			await action();
			if (successMessage) notice.toast("success", successMessage);
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}

	return (
		<>
			<PageHeader
				title={t("Domains")}
				subtitle={t("Prove ownership of the domains your resources run on.")}
				crumbs={[{ label: t("Admin") }, { label: t("Domains") }]}
			/>
			<ErrorNote message={items === null && error ? null : error} />
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
					<Table head={[t("Hostname"), t("TXT record"), t("Value"), t("Status"), ""]} rightCols={[4]}>
						{table.rows.map(row => (
							<tr key={row.id}>
								<td>{row.hostname}</td>
								<td><MonoId value={`_msauth.${row.hostname}`} mask={false} /></td>
								<td><MonoId value={row.challenge} wide /></td>
								<td>{row.verifiedAt ? <Badge tone="ok">{t("verified")}</Badge> : <Badge tone="warn">{t("pending")}</Badge>}</td>
								<td className="right">
									{!row.verifiedAt && (
										<Button kind="ghost" disabled={busy} onClick={() => void run(() => post(`/api/v1/domains/${row.id}/verify`), t("Domain verified."))}>{t("Verify")}</Button>
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
