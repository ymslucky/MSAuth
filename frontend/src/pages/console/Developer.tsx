import { useEffect, useState } from "react";
import { api, del, fmtDate, patch, post } from "../../api";
import { Badge, Button, Card, Empty, ErrorNote, Field, Modal, Table } from "../../ui";

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
	return (
		<Modal title={props.title} open onClose={props.onDone}>
			<p className="muted">Copy it now — this value is never shown again.</p>
			<p><code>{props.secret}</code></p>
			<Button kind="primary" onClick={props.onDone}>Done</Button>
		</Modal>
	);
}

export function Applications() {
	const [items, setItems] = useState<AppRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<AppRow | null>(null);
	const [secret, setSecret] = useState<string | null>(null);

	const reload = () => api<{ items: AppRow[] }>("/api/v1/applications").then(result => setItems(result.items ?? [])).catch(cause => setError(String(cause.message)));
	useEffect(() => { void reload(); }, []);

	async function run(action: () => Promise<unknown>, message?: string) {
		setError(null);
		try {
			await action();
			if (message) setSecret(message);
			await reload();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	}

	return (
		<>
			<div className="main-head">
				<div>
					<h1>Applications</h1>
					<p>OAuth clients you own. Callback URLs are exact-match; DPoP-bound clients get proof-key tokens.</p>
				</div>
				<Button kind="primary" onClick={() => setCreating(true)}>New application</Button>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>No applications yet.</Empty> : (
					<Table head={["Name", "Client ID", "Callbacks", "Status", ""]}>
						{items.map(row => (
							<tr key={row.client_id}>
								<td>{row.client_name}</td>
								<td><code>{row.client_id}</code></td>
								<td className="mono muted">{(row.redirect_uris ?? []).join(", ")}</td>
								<td>{row.disabled ? <Badge tone="bad">disabled</Badge> : <Badge tone="ok">active</Badge>}</td>
								<td>
									<div className="btn-row">
										<Button kind="ghost" onClick={() => setEditing(row)}>Edit</Button>
										<Button kind="ghost" onClick={() => { if (confirm("Rotate this client secret?")) void run(() => post<{ client_secret?: string }>(`/api/v1/applications/${row.client_id}/rotate`), undefined); }}>Rotate</Button>
										<Button kind="danger" onClick={() => { if (confirm("Delete this application and all its tokens?")) void run(() => del(`/api/v1/applications/${row.client_id}`)); }}>Delete</Button>
									</div>
								</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{creating && (
				<AppForm
					onClose={() => setCreating(false)}
					onSave={input => run(async () => {
						const created = await post<AppRow & { client_secret?: string }>("/api/v1/applications", input);
						setCreating(false);
						if (created.client_secret) setSecret(created.client_secret);
					})}
				/>
			)}
			{editing && (
				<AppForm
					initial={editing}
					onClose={() => setEditing(null)}
					onSave={input => run(async () => {
						await patch(`/api/v1/applications/${editing.client_id}`, input);
						setEditing(null);
					})}
				/>
			)}
			{secret && <SecretReveal title="New client secret" secret={secret} onDone={() => setSecret(null)} />}
		</>
	);
}

function AppForm(props: { initial?: AppRow; onClose: () => void; onSave: (input: { name: string; redirectUris: string[]; confidential: boolean; dpop: boolean }) => void }) {
	const [name, setName] = useState(props.initial?.client_name ?? "");
	const [redirects, setRedirects] = useState((props.initial?.redirect_uris ?? []).join("\n"));
	const [confidential, setConfidential] = useState(false);
	const [dpop, setDpop] = useState(true);
	return (
		<Modal title={props.initial ? "Edit application" : "New application"} open onClose={props.onClose}>
			<Field label="Name">
				<input value={name} onChange={event => setName(event.target.value)} maxLength={100} />
			</Field>
			<Field label="Callback URLs" hint="One per line. Exact HTTPS URLs, or http loopback for native apps.">
				<textarea rows={3} value={redirects} onChange={event => setRedirects(event.target.value)} spellCheck={false} />
			</Field>
			{!props.initial && (
				<>
					<label className="checks">
						<span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
							<input type="checkbox" checked={confidential} onChange={event => setConfidential(event.target.checked)} /> Confidential client (client secret)
						</span>
						<span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
							<input type="checkbox" checked={dpop} onChange={event => setDpop(event.target.checked)} /> Require DPoP-bound tokens
						</span>
					</label>
				</>
			)}
			<div className="btn-row">
				<Button kind="primary" disabled={!name.trim() || !redirects.trim()} onClick={() => props.onSave({
					name: name.trim(),
					redirectUris: redirects.split("\n").map(value => value.trim()).filter(Boolean),
					confidential, dpop,
				})}>Save</Button>
				<Button kind="ghost" onClick={props.onClose}>Cancel</Button>
			</div>
		</Modal>
	);
}

export function Keys() {
	const [items, setItems] = useState<KeyRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [secret, setSecret] = useState<string | null>(null);

	const reload = () => api<{ apiKeys: KeyRow[] }>("/api/v1/keys").then(result => setItems(result.apiKeys ?? [])).catch(cause => setError(String(cause.message)));
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
					<h1>API keys</h1>
					<p>Personal automation keys. 30-day expiry, 60 requests per minute.</p>
				</div>
				<Button kind="primary" onClick={() => setCreating(true)}>New key</Button>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>No API keys.</Empty> : (
					<Table head={["Name", "Key", "Created", "Expires", "Last used", ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td><code>{row.start ?? row.id}…</code></td>
								<td className="muted">{fmtDate(row.createdAt)}</td>
								<td className="muted">{fmtDate(row.expiresAt)}</td>
								<td className="muted">{fmtDate(row.lastRequestAt)}</td>
								<td><Button kind="danger" onClick={() => { if (confirm("Revoke this key?")) void run(() => del(`/api/v1/keys/${row.id}`)); }}>Revoke</Button></td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{creating && (
				<Modal title="New API key" open onClose={() => setCreating(false)}>
					<KeyForm onSave={name => run(async () => {
						const created = await post<{ key: string }>("/api/v1/keys", { name });
						setCreating(false);
						setSecret(created.key);
					})} />
				</Modal>
			)}
			{secret && <SecretReveal title="Your new API key" secret={secret} onDone={() => setSecret(null)} />}
		</>
	);
}

function KeyForm(props: { onSave: (name: string) => void }) {
	const [name, setName] = useState("");
	return (
		<>
			<Field label="Key name">
				<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="ci-deploy" />
			</Field>
			<div className="btn-row">
				<Button kind="primary" disabled={!name.trim()} onClick={() => props.onSave(name.trim())}>Create</Button>
			</div>
		</>
	);
}

export function Resources(props: { operator: boolean }) {
	const [items, setItems] = useState<ResourceRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [identifier, setIdentifier] = useState("");
	const [name, setName] = useState("");
	const [linkTarget, setLinkTarget] = useState({ identifier: "", clientId: "" });

	const reload = () => api<{ items: ResourceRow[] }>("/api/v1/resources").then(result => setItems(result.items ?? [])).catch(cause => setError(String(cause.message)));
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
					<h1>Resources</h1>
					<p>HTTPS APIs (e.g. MCP servers) that accept MSAuth tokens. Token audience is pinned to the exact identifier.</p>
				</div>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>No resources registered.</Empty> : (
					<Table head={["Name", "Identifier", "TTL", "DPoP required", "Status"]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td><code>{row.identifier}</code></td>
								<td className="muted">{row.accessTokenTtl ?? 300}s</td>
								<td>{row.dpopBoundAccessTokensRequired ? "yes" : "no"}</td>
								<td>{row.disabled ? <Badge tone="bad">disabled</Badge> : <Badge tone="ok">active</Badge>}</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{props.operator && (
				<>
					<Card title="Register resource">
						<div className="field-row">
							<Field label="Identifier"><input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="https://mcp.example.com/mcp" spellCheck={false} /></Field>
							<Field label="Name"><input value={name} onChange={event => setName(event.target.value)} placeholder="Notes MCP" /></Field>
						</div>
						<Button kind="primary" disabled={!identifier.trim() || !name.trim()} onClick={() => void run(async () => {
							await post("/api/v1/resources", { identifier: identifier.trim(), name: name.trim() });
							setIdentifier("");
							setName("");
						})}>Register</Button>
					</Card>
					<Card title="Link client to resource">
						<div className="field-row">
							<Field label="Resource identifier"><input value={linkTarget.identifier} onChange={event => setLinkTarget({ ...linkTarget, identifier: event.target.value })} spellCheck={false} /></Field>
							<Field label="Client ID"><input value={linkTarget.clientId} onChange={event => setLinkTarget({ ...linkTarget, clientId: event.target.value })} spellCheck={false} /></Field>
						</div>
						<Button kind="primary" disabled={!linkTarget.identifier.trim() || !linkTarget.clientId.trim()} onClick={() => void run(async () => {
							await post("/api/v1/resources/link", { identifier: linkTarget.identifier.trim(), clientId: linkTarget.clientId.trim() });
							setLinkTarget({ identifier: "", clientId: "" });
						})}>Link</Button>
					</Card>
				</>
			)}
		</>
	);
}
