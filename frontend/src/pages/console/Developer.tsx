import { useEffect, useState } from "react";
import { api, del, fmtDate, fullTimestamp, patch, post } from "../../api";
import { useT } from "../../i18n";
import {
	Badge, Button, Card, CopyButton, Empty, ErrorNote, ErrorState, Field,
	Modal, MonoId, PageHeader, SkeletonTable, Table, useNotice,
} from "../../ui";
interface AppRow {
	client_id: string;
	client_name: string | null;
	redirect_uris: string[] | null;
	grant_types: string[] | null;
	disabled: number | null;
	userId: string | null;
	createdAt: number;
}

interface KeyRow {
	id: string;
	name: string | null;
	start: string | null;
	createdAt: number;
	expiresAt: number | null;
	enabled: boolean | null;
	lastRequestAt: number | null;
}

interface ResourceRow {
	id: string;
	identifier: string;
	name: string;
	accessTokenTtl: number | null;
	allowedScopes: string | null;
	dpopBoundAccessTokensRequired: number | null;
	disabled: number | null;
}

function SecretReveal(props: { title: string; secret: string; onDone: () => void }) {
	const t = useT();
	return (
		<Modal title={props.title} open onClose={props.onDone}>
			<p className="muted">{t("Copy it now — this value is never shown again.")}</p>
			<code className="secret-box">{props.secret}</code>
			<div className="btn-row">
				<CopyButton value={props.secret} />
				<Button kind="primary" onClick={props.onDone}>{t("Done")}</Button>
			</div>
		</Modal>
	);
}

export function Applications() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<AppRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<AppRow | null>(null);
	const [secret, setSecret] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const reload = () => api<{ items: AppRow[] }>("/api/v1/applications")
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

	const guardedRun = (title: string, action: () => Promise<unknown>, successMessage?: string) => {
		void (async () => {
			if (!(await notice.confirm({ title, confirmLabel: t("Confirm") }))) return;
			await run(action, successMessage);
		})();
	};

	return (
		<>
			<PageHeader
				title={t("Applications")}
				subtitle={t("OAuth clients you own. Callback URLs are exact-match; DPoP-bound clients get proof-key tokens.")}
				crumbs={[{ label: t("Developer") }, { label: t("Applications") }]}
				actions={<Button kind="primary" onClick={() => setCreating(true)}>{t("New application")}</Button>}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<Empty glyph="@" action={<Button kind="primary" onClick={() => setCreating(true)}>{t("New application")}</Button>}>
						{t("No applications yet.")}
					</Empty>
				) : (
					<Table head={[t("Name"), t("Client ID"), t("Callbacks"), t("Status"), ""]} rightCols={[4]}>
						{items.map(row => (
							<tr key={row.client_id}>
								<td>{row.client_name}</td>
								<td><MonoId value={row.client_id} /></td>
								<td className="mono muted">{(row.redirect_uris ?? []).join(", ")}</td>
								<td>{row.disabled ? <Badge tone="bad">{t("disabled")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}</td>
								<td className="right">
									<div className="btn-row">
										<Button kind="ghost" onClick={() => setEditing(row)}>{t("Edit")}</Button>
										<Button kind="ghost" onClick={() => guardedRun(t("Rotate this client secret?"), async () => {
											const rotated = await post<{ client_secret?: string }>(`/api/v1/applications/${row.client_id}/rotate`);
											if (rotated.client_secret) setSecret(rotated.client_secret);
											notice.toast("success", t("Client secret rotated."));
										})}>{t("Rotate")}</Button>
										<Button kind="danger" onClick={() => guardedRun(t("Delete this application and all its tokens?"), async () => {
											await del(`/api/v1/applications/${row.client_id}`);
											notice.toast("success", t("Application deleted."));
										})}>{t("Delete")}</Button>
									</div>
								</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{creating && (
				<AppForm
					pending={saving}
					onClose={() => setCreating(false)}
					onSave={input => {
						setSaving(true);
						void run(async () => {
							const created = await post<AppRow & { client_secret?: string }>("/api/v1/applications", input);
							setCreating(false);
							notice.toast("success", t("Application created."));
							if (created.client_secret) setSecret(created.client_secret);
						}).finally(() => setSaving(false));
					}}
				/>
			)}
			{editing && (
				<AppForm
					initial={editing}
					pending={saving}
					onClose={() => setEditing(null)}
					onSave={input => {
						setSaving(true);
						void run(async () => {
							await patch(`/api/v1/applications/${editing.client_id}`, input);
							setEditing(null);
							notice.toast("success", t("Application updated."));
						}).finally(() => setSaving(false));
					}}
				/>
			)}
			{secret && <SecretReveal title={t("New client secret")} secret={secret} onDone={() => setSecret(null)} />}
		</>
	);
}

function AppForm(props: {
	initial?: AppRow;
	pending: boolean;
	onClose: () => void;
	onSave: (input: { name: string; redirectUris: string[]; confidential: boolean; dpop: boolean }) => void;
}) {
	const t = useT();
	const [name, setName] = useState(props.initial?.client_name ?? "");
	const [redirects, setRedirects] = useState((props.initial?.redirect_uris ?? []).join("\n"));
	const [confidential, setConfidential] = useState(false);
	const [dpop, setDpop] = useState(true);
	return (
		<Modal title={props.initial ? t("Edit application") : t("New application")} open onClose={props.onClose}>
			<Field label={t("Name")} count={`${name.length}/100`}>
				<input value={name} onChange={event => setName(event.target.value)} maxLength={100} />
			</Field>
			<Field label={t("Callback URLs")} hint={t("One per line. Exact HTTPS URLs, or http loopback for native apps.")}>
				<textarea rows={3} value={redirects} onChange={event => setRedirects(event.target.value)} spellCheck={false} />
			</Field>
			{!props.initial && (
				<div className="checks">
					<label className="check-row">
						<input type="checkbox" checked={confidential} onChange={event => setConfidential(event.target.checked)} /> {t("Confidential client (client secret)")}
					</label>
					<label className="check-row">
						<input type="checkbox" checked={dpop} onChange={event => setDpop(event.target.checked)} /> {t("Require DPoP-bound tokens")}
					</label>
				</div>
			)}
			<div className="btn-row">
				<Button kind="primary" disabled={props.pending || !name.trim() || !redirects.trim()} onClick={() => props.onSave({
					name: name.trim(),
					redirectUris: redirects.split("\n").map(value => value.trim()).filter(Boolean),
					confidential, dpop,
				})}>{t("Save")}</Button>
				<Button kind="ghost" disabled={props.pending} onClick={props.onClose}>{t("Cancel")}</Button>
			</div>
		</Modal>
	);
}

export function Keys() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<KeyRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [creating, setCreating] = useState(false);
	const [secret, setSecret] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [revoking, setRevoking] = useState(false);

	const reload = () => api<{ apiKeys: KeyRow[] }>("/api/v1/keys")
		.then(result => { setItems(result.apiKeys ?? []); setError(null); })
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

	async function revoke(id: string) {
		setError(null);
		if (!(await notice.confirm({ title: t("Revoke this key?"), confirmLabel: t("Revoke") }))) return;
		setRevoking(true);
		try {
			await del(`/api/v1/keys/${id}`);
			notice.toast("success", t("API key revoked."));
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
				title={t("API keys")}
				subtitle={t("Personal automation keys. 30-day expiry, 60 requests per minute.")}
				crumbs={[{ label: t("Developer") }, { label: t("API keys") }]}
				actions={<Button kind="primary" onClick={() => setCreating(true)}>{t("New key")}</Button>}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<Empty glyph="*" action={<Button kind="primary" onClick={() => setCreating(true)}>{t("New key")}</Button>}>
						{t("No API keys.")}
					</Empty>
				) : (
					<Table head={[t("Name"), t("Key"), t("Created"), t("Expires"), t("Last used"), ""]} rightCols={[5]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td><MonoId value={`${row.start ?? row.id}…`} /></td>
								<td className="muted"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
								<td className="muted"><time title={fullTimestamp(row.expiresAt)}>{fmtDate(row.expiresAt)}</time></td>
								<td className="muted"><time title={fullTimestamp(row.lastRequestAt)}>{fmtDate(row.lastRequestAt)}</time></td>
								<td className="right"><Button kind="danger" disabled={revoking} onClick={() => void revoke(row.id)}>{t("Revoke")}</Button></td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{creating && (
				<Modal title={t("New API key")} open onClose={() => setCreating(false)}>
					<KeyForm pending={saving} onSave={name => {
						setSaving(true);
						void run(async () => {
							const created = await post<{ key: string }>("/api/v1/keys", { name });
							setCreating(false);
							notice.toast("success", t("API key created."));
							setSecret(created.key);
						}).finally(() => setSaving(false));
					}} />
				</Modal>
			)}
			{secret && <SecretReveal title={t("Your new API key")} secret={secret} onDone={() => setSecret(null)} />}
		</>
	);
}

function KeyForm(props: { pending: boolean; onSave: (name: string) => void }) {
	const t = useT();
	const [name, setName] = useState("");
	return (
		<>
			<Field label={t("Key name")} count={`${name.length}/100`}>
				<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="ci-deploy" spellCheck={false} />
			</Field>
			<div className="btn-row">
				<Button kind="primary" disabled={props.pending || !name.trim()} onClick={() => props.onSave(name.trim())}>{t("Create")}</Button>
			</div>
		</>
	);
}

export function Resources(props: { operator: boolean }) {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<ResourceRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [identifier, setIdentifier] = useState("");
	const [name, setName] = useState("");
	const [linkTarget, setLinkTarget] = useState({ identifier: "", clientId: "" });
	const [saving, setSaving] = useState(false);

	const reload = () => api<{ items: ResourceRow[] }>("/api/v1/resources")
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
				title={t("Resources")}
				subtitle={t("HTTPS APIs (e.g. MCP servers) that accept MSAuth tokens. Token audience is pinned to the exact identifier.")}
				crumbs={[{ label: t("Developer") }, { label: t("Resources") }]}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<Empty glyph="§">{t("No resources registered.")}</Empty>
				) : (
					<Table head={[t("Name"), t("Identifier"), t("TTL"), t("DPoP required"), t("Status")]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td><MonoId value={row.identifier} wide /></td>
								<td className="mono muted">{row.accessTokenTtl ?? 300}s</td>
								<td>{row.dpopBoundAccessTokensRequired ? t("yes") : t("no")}</td>
								<td>{row.disabled ? <Badge tone="bad">{t("disabled")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{props.operator && (
				<>
					<Card title={t("Register resource")}>
						<div className="field-row">
							<Field label={t("Identifier")}><input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="https://mcp.example.com/mcp" spellCheck={false} /></Field>
							<Field label={t("Name")}><input value={name} onChange={event => setName(event.target.value)} placeholder="Notes MCP" /></Field>
						</div>
						<Button kind="primary" disabled={saving || !identifier.trim() || !name.trim()} onClick={() => {
							setSaving(true);
							void run(async () => {
								await post("/api/v1/resources", { identifier: identifier.trim(), name: name.trim() });
								setIdentifier("");
								setName("");
							}, t("Resource registered.")).finally(() => setSaving(false));
						}}>{t("Register")}</Button>
					</Card>
					<Card title={t("Link client to resource")}>
						<div className="field-row">
							<Field label={t("Resource identifier")}><input value={linkTarget.identifier} onChange={event => setLinkTarget({ ...linkTarget, identifier: event.target.value })} spellCheck={false} /></Field>
							<Field label={t("Client ID")}><input value={linkTarget.clientId} onChange={event => setLinkTarget({ ...linkTarget, clientId: event.target.value })} spellCheck={false} /></Field>
						</div>
						<Button kind="primary" disabled={saving || !linkTarget.identifier.trim() || !linkTarget.clientId.trim()} onClick={() => {
							setSaving(true);
							void run(async () => {
								await post("/api/v1/resources/link", { identifier: linkTarget.identifier.trim(), clientId: linkTarget.clientId.trim() });
								setLinkTarget({ identifier: "", clientId: "" });
							}, t("Client linked to resource.")).finally(() => setSaving(false));
						}}>{t("Link")}</Button>
					</Card>
				</>
			)}
		</>
	);
}
