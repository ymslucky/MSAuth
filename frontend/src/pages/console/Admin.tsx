import { useEffect, useState } from "react";
import { api, del, fmtDate, patch, post } from "../../api";
import { Badge, Button, Card, Empty, ErrorNote, Field, Modal, Table } from "../../ui";

interface UserRow {
	id: string;
	name: string;
	email: string;
	emailVerified: number | null;
	banned: boolean | null;
	twoFactorEnabled: boolean | null;
	createdAt: number;
}

interface UserDetail {
	user: UserRow;
	sessions: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: number; expiresAt: number }[];
	accounts: { id: string; providerId: string; accountId: string; createdAt: number }[];
}

export function Users() {
	const [items, setItems] = useState<UserRow[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [query, setQuery] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [detail, setDetail] = useState<UserDetail | null>(null);

	const reload = () => {
		const params = new URLSearchParams({ page: String(page), ...(query.trim() ? { q: query.trim() } : {}) });
		api<{ items: UserRow[]; total?: number }>(`/api/v1/users?${params}`)
			.then(result => { setItems(result.items ?? []); setTotal(result.total ?? result.items?.length ?? 0); })
			.catch(cause => setError(String(cause.message)));
	};
	useEffect(() => { void reload(); }, [page, query]);

	async function run(action: () => Promise<unknown>) {
		setError(null);
		try {
			await action();
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}

	const pages = Math.max(1, Math.ceil(total / 30));
	return (
		<>
			<div className="main-head">
				<div>
					<h1>Users</h1>
					<p>Platform identities. Suspension revokes agents, delegations, clients and keys.</p>
				</div>
			</div>
			<ErrorNote message={error} />
			<Card>
				<Field label="Search email or name">
					<input value={query} onChange={event => { setPage(1); setQuery(event.target.value); }} spellCheck={false} />
				</Field>
				{items.length === 0 ? <Empty>No matching users.</Empty> : (
					<Table head={["User", "Verified", "2FA", "Created", "Status", ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}<div className="muted">{row.email}</div></td>
								<td>{row.emailVerified ? <Badge tone="ok">yes</Badge> : <Badge tone="warn">no</Badge>}</td>
								<td>{row.twoFactorEnabled ? <Badge>on</Badge> : <span className="muted">off</span>}</td>
								<td className="muted">{fmtDate(row.createdAt)}</td>
								<td>{row.banned ? <Badge tone="bad">suspended</Badge> : <Badge tone="ok">active</Badge>}</td>
								<td>
									<div className="btn-row">
										<Button kind="ghost" onClick={() => void api<UserDetail>(`/api/v1/users/${row.id}`).then(setDetail).catch(cause => setError(String(cause.message)))}>Detail</Button>
										{row.banned ? (
											<Button kind="ghost" onClick={() => void run(() => post(`/api/v1/users/${row.id}/unban`))}>Unsuspend</Button>
										) : (
											<Button kind="danger" onClick={() => {
												const reason = prompt("Suspension reason?");
												if (reason) void run(() => post(`/api/v1/users/${row.id}/ban`, { reason }));
											}}>Suspend</Button>
										)}
									</div>
								</td>
							</tr>
						))}
					</Table>
				)}
				{pages > 1 && (
					<div className="btn-row" style={{ marginTop: 12 }}>
						<Button kind="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</Button>
						<span className="muted">{page} / {pages}</span>
						<Button kind="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</Button>
					</div>
				)}
			</Card>
			{detail && (
				<Modal title="User detail" open onClose={() => setDetail(null)}>
					<p><strong>{detail.user.name}</strong> <span className="muted">{detail.user.email}</span></p>
					<h2 style={{ margin: "14px 0 6px" }}>Sessions</h2>
					{detail.sessions.length === 0 ? <Empty>None.</Empty> : (
						<Table head={["Created", "IP", "Agent"]}>
							{detail.sessions.map(session => (
								<tr key={session.id}>
									<td className="muted">{fmtDate(session.createdAt)}</td>
									<td className="mono">{session.ipAddress ?? "—"}</td>
									<td className="muted">{(session.userAgent ?? "").slice(0, 40)}</td>
								</tr>
							))}
						</Table>
					)}
					<h2 style={{ margin: "14px 0 6px" }}>Linked accounts</h2>
					{detail.accounts.length === 0 ? <Empty>None.</Empty> : (
						<Table head={["Provider", "Account ID", "Linked"]}>
							{detail.accounts.map(account => (
								<tr key={account.id}>
									<td><code>{account.providerId}</code></td>
									<td className="mono muted">{account.accountId}</td>
									<td className="muted">{fmtDate(account.createdAt)}</td>
								</tr>
							))}
						</Table>
					)}
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
	const [data, setData] = useState<SettingsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const reload = () => api<SettingsResponse>("/api/v1/settings").then(setData).catch(cause => setError(String(cause.message)));
	useEffect(() => { void reload(); }, []);

	async function toggle(key: "registrationEnabled" | "dcrEnabled", value: boolean) {
		setError(null);
		try {
			await patch("/api/v1/settings", { [key]: value });
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}

	if (error && !data) return <ErrorNote message={error} />;
	if (!data) return <p className="muted">Loading…</p>;
	return (
		<>
			<div className="main-head">
				<div>
					<h1>Platform settings</h1>
					<p>Issuer: <code>{data.issuer}</code></p>
				</div>
			</div>
			<ErrorNote message={error} />
			<Card title="Registration">
				<label style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
					<input type="checkbox" checked={data.registrationEnabled} onChange={event => void toggle("registrationEnabled", event.target.checked)} />
					Allow new users to sign up (GitHub). Allowlisted admins can always sign in.
				</label>
			</Card>
			<Card title="Dynamic client registration">
				<label style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
					<input type="checkbox" checked={data.dcrEnabled} onChange={event => void toggle("dcrEnabled", event.target.checked)} />
					Allow unauthenticated OAuth clients to self-register (RFC 7591) — required for MCP client auto-discovery.
				</label>
			</Card>
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
	const [items, setItems] = useState<DomainRow[]>([]);
	const [hostname, setHostname] = useState("");
	const [error, setError] = useState<string | null>(null);

	const reload = () => api<{ items: DomainRow[] }>("/api/v1/domains").then(result => setItems(result.items ?? [])).catch(cause => setError(String(cause.message)));
	useEffect(() => { void reload(); }, []);

	async function run(action: () => Promise<unknown>) {
		setError(null);
		try {
			await action();
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}

	return (
		<>
			<div className="main-head">
				<div>
					<h1>Domains</h1>
					<p>Prove ownership of the domains your resources run on.</p>
				</div>
			</div>
			<ErrorNote message={error} />
			<Card title="Add domain">
				<div className="field-row">
					<Field label="Hostname"><input value={hostname} onChange={event => setHostname(event.target.value)} placeholder="example.com" spellCheck={false} /></Field>
				</div>
				<Button kind="primary" disabled={!hostname.trim()} onClick={() => void run(async () => {
					await post("/api/v1/domains", { hostname: hostname.trim() });
					setHostname("");
				})}>Add</Button>
			</Card>
			<Card title="Your domains">
				{items.length === 0 ? <Empty>No domains added.</Empty> : (
					<Table head={["Hostname", "TXT record", "Value", "Status", ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.hostname}</td>
								<td><code>_msauth.{row.hostname}</code></td>
								<td><code>{row.challenge}</code></td>
								<td>{row.verifiedAt ? <Badge tone="ok">verified</Badge> : <Badge tone="warn">pending</Badge>}</td>
								<td>
									{!row.verifiedAt && (
										<div className="btn-row">
											<Button kind="ghost" onClick={() => void run(() => post(`/api/v1/domains/${row.id}/verify`))}>Verify</Button>
										</div>
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
