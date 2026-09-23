import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban } from "lucide-react";
import { api, del, fmtDate, fullTimestamp, patch, post } from "../../api";
import { useT } from "../../i18n";
import { navigate } from "../../router";
import {
	Badge, Button, Card, CopyButton, Empty, ErrorNote, ErrorState, Field,
	Modal, MonoId, PageHeader, SkeletonTable, SkeletonStats, Table, useNotice,
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

export function Users() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<UserRow[] | null>(null);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
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

	const pages = Math.max(1, Math.ceil(total / 30));
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
					<Empty glyph="?">{t("No matching users.")}</Empty>
				) : (
					<>
						<Table head={[t("User"), t("Verified"), t("2FA"), t("Created"), t("Status"), ""]} rightCols={[5]}>
							{items.map(row => (
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
							<div className="btn-row" style={{ marginTop: 14 }}>
								<Button kind="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("← Prev")}</Button>
								<span className="muted mono">{page} / {pages}</span>
								<Button kind="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next →")}</Button>
							</div>
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
				: <SkeletonTable rows={4} />
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
						{detail.sessions.length === 0 ? <Empty>{t("None.")}</Empty> : (
							<Table head={[t("Created"), "IP", t("User agent"), t("Expires")]}>
								{detail.sessions.map(session => (
									<tr key={session.id}>
										<td className="muted"><time title={fullTimestamp(session.createdAt)}>{fmtDate(session.createdAt)}</time></td>
										<td><MonoId value={session.ipAddress ?? "—"} /></td>
										<td className="muted"><span title={session.userAgent ?? ""}>{(session.userAgent ?? "").slice(0, 60)}</span></td>
										<td className="muted"><time title={fullTimestamp(session.expiresAt)}>{fmtDate(session.expiresAt)}</time></td>
									</tr>
								))}
							</Table>
						)}
					</Card>
					<Card title={t("Linked accounts")}>
						{detail.accounts.length === 0 ? <Empty>{t("None.")}</Empty> : (
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
					<Empty glyph="#">{t("No domains added.")}</Empty>
				) : (
					<Table head={[t("Hostname"), t("TXT record"), t("Value"), t("Status"), ""]} rightCols={[4]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.hostname}</td>
								<td><MonoId value={`_msauth.${row.hostname}`} /></td>
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
				)}
			</Card>
		</>
	);
}
