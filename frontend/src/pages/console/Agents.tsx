import { useEffect, useState } from "react";
import { api, del, fmtDate, post } from "../../api";
import { Badge, Button, Card, Empty, ErrorNote, Field, Modal, Table } from "../../ui";

const AGENT_SCOPES = ["mcp:invoke", "agent:delegate"];

interface AgentRow {
	id: string;
	name: string;
	description: string;
	clientId: string | null;
	dpopJkt: string | null;
	status: "active" | "revoked";
	createdAt: number;
}

interface DelegationRow {
	id: string;
	agentId: string;
	agentName: string;
	resource: string;
	scopes: string[];
	authorizationDetails: { actions: string[]; identifiers: string[] }[];
	expiresAt: number;
	revokedAt: number | null;
	depth: number;
	createdAt: number;
}

export function Agents() {
	const [items, setItems] = useState<AgentRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const reload = () => api<{ items: AgentRow[] }>("/api/v1/agents").then(result => setItems(result.items ?? [])).catch(cause => setError(String(cause.message)));
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
					<h1>Agents</h1>
					<p>Agent instances acting on your behalf. Each one is pinned to an OAuth client and a DPoP key fingerprint.</p>
				</div>
				<Button kind="primary" onClick={() => setCreating(true)}>Register agent</Button>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>No agents registered.</Empty> : (
					<Table head={["Name", "Client", "DPoP key", "Status", "Created", ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}{row.description && <div className="muted">{row.description}</div>}</td>
								<td>{row.clientId ? <code>{row.clientId.slice(0, 18)}…</code> : <span className="muted">not bound</span>}</td>
								<td>{row.dpopJkt ? <code>{row.dpopJkt.slice(0, 12)}…</code> : <span className="muted">—</span>}</td>
								<td>{row.status === "active" ? <Badge tone="ok">active</Badge> : <Badge tone="bad">revoked</Badge>}</td>
								<td className="muted">{fmtDate(row.createdAt)}</td>
								<td>
									{row.status === "active" && (
										<Button kind="danger" onClick={() => { if (confirm("Revoke this agent, its delegations and tokens?")) void run(() => del(`/api/v1/agents/${row.id}`)); }}>Revoke</Button>
									)}
								</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{creating && (
				<AgentForm onClose={() => setCreating(false)} onSave={input => run(async () => {
					await post("/api/v1/agents", input);
					setCreating(false);
				})} />
			)}
		</>
	);
}

function AgentForm(props: { onClose: () => void; onSave: (input: { name: string; description: string; clientId?: string; publicJwk?: unknown }) => void }) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [clientId, setClientId] = useState("");
	const [publicJwk, setPublicJwk] = useState("");
	return (
		<Modal title="Register agent" open onClose={props.onClose}>
			<Field label="Name"><input value={name} onChange={event => setName(event.target.value)} maxLength={100} /></Field>
			<Field label="Description"><input value={description} onChange={event => setDescription(event.target.value)} maxLength={500} /></Field>
			<Field label="OAuth client ID" hint="Optional now — the agent can also self-register via DCR later.">
				<input value={clientId} onChange={event => setClientId(event.target.value)} spellCheck={false} />
			</Field>
			<Field label="Agent public key (P-256 JWK)" hint="Public key only. Tokens will be DPoP-bound to its thumbprint.">
				<textarea rows={4} value={publicJwk} onChange={event => setPublicJwk(event.target.value)} spellCheck={false} placeholder='{"kty":"EC","crv":"P-256","x":"…","y":"…"}' />
			</Field>
			<div className="btn-row">
				<Button kind="primary" disabled={!name.trim()} onClick={() => {
					let jwk: unknown;
					if (publicJwk.trim()) {
						try { jwk = JSON.parse(publicJwk); } catch { alert("Public key must be valid JSON"); return; }
					}
					props.onSave({
						name: name.trim(), description: description.trim(),
						...(clientId.trim() && jwk ? { clientId: clientId.trim(), publicJwk: jwk } : {}),
					});
				}}>Register</Button>
				<Button kind="ghost" onClick={props.onClose}>Cancel</Button>
			</div>
		</Modal>
	);
}

export function Delegations() {
	const [items, setItems] = useState<DelegationRow[]>([]);
	const [agents, setAgents] = useState<AgentRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const reload = () => api<{ items: DelegationRow[] }>("/api/v1/delegations").then(result => setItems(result.items ?? [])).catch(cause => setError(String(cause.message)));
	useEffect(() => {
		void reload();
		api<{ items: AgentRow[] }>("/api/v1/agents").then(result => setAgents((result.items ?? []).filter(agent => agent.status === "active" && agent.clientId && agent.dpopJkt))).catch(() => undefined);
	}, []);

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
					<h1>Delegations</h1>
					<p>Explicit consent for an agent to act as you on one resource. Authority only ever narrows, up to 4 hops.</p>
				</div>
				<Button kind="primary" onClick={() => setCreating(true)}>New delegation</Button>
			</div>
			<ErrorNote message={error} />
			<Card>
				{items.length === 0 ? <Empty>No delegations.</Empty> : (
					<Table head={["Agent", "Resource", "Scopes / permissions", "Depth", "Expires", "Status", ""]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.agentName}</td>
								<td><code>{row.resource}</code></td>
								<td>{row.scopes.join(", ")}<div className="muted mono">{JSON.stringify(row.authorizationDetails)}</div></td>
								<td>{row.depth}{row.depth > 0 && <div className="muted">chain</div>}</td>
								<td className="muted">{fmtDate(row.expiresAt)}</td>
								<td>{row.revokedAt ? <Badge tone="bad">revoked</Badge> : row.expiresAt < Date.now() ? <Badge tone="warn">expired</Badge> : <Badge tone="ok">live</Badge>}</td>
								<td>
									{!row.revokedAt && (
										<Button kind="danger" onClick={() => { if (confirm("Revoke this delegation (and any children)?")) void run(() => del(`/api/v1/delegations/${row.id}`)); }}>Revoke</Button>
									)}
								</td>
							</tr>
						))}
					</Table>
				)}
			</Card>
			{creating && (
				<DelegationForm agents={agents} onClose={() => setCreating(false)} onSave={input => run(async () => {
					await post("/api/v1/delegations", input);
					setCreating(false);
				})} />
			)}
		</>
	);
}

function DelegationForm(props: { agents: AgentRow[]; onClose: () => void; onSave: (input: Record<string, unknown>) => void }) {
	const [agentId, setAgentId] = useState(props.agents[0]?.id ?? "");
	const [resource, setResource] = useState("");
	const [scopes, setScopes] = useState<string[]>(["mcp:invoke"]);
	const [parentId, setParentId] = useState("");
	const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
	const bindable = props.agents.length > 0;
	return (
		<Modal title="New delegation" open onClose={props.onClose}>
			{!bindable ? (
				<>
					<p className="muted">Register an agent bound to an OAuth client and a DPoP key first — a delegation needs both.</p>
					<Button onClick={props.onClose}>Close</Button>
				</>
			) : (
				<>
					<Field label="Agent">
						<select value={agentId} onChange={event => setAgentId(event.target.value)}>
							{props.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
						</select>
					</Field>
					<Field label="Resource identifier"><input value={resource} onChange={event => setResource(event.target.value)} placeholder="https://mcp.example.com/mcp" spellCheck={false} /></Field>
					<div className="field">
						<span>Scopes</span>
						{AGENT_SCOPES.map(scope => (
							<label key={scope} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
								<input
									type="checkbox"
									checked={scopes.includes(scope)}
									onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope))}
								/>
								<code>{scope}</code>
							</label>
						))}
					</div>
					<Field label="Parent delegation (optional)" hint="Children may only narrow the parent's authority and expiry.">
						<input value={parentId} onChange={event => setParentId(event.target.value)} spellCheck={false} />
					</Field>
					<Field label="Expires at" hint="Between one minute and 30 days from now.">
						<input type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
					</Field>
					<div className="btn-row">
						<Button
							kind="primary"
							disabled={!agentId || !resource.trim() || scopes.length === 0}
							onClick={() => props.onSave({
								agentId,
								resource: resource.trim(),
								scopes,
								expiresAt: new Date(expiresAt).getTime(),
								...(parentId.trim() ? { parentId: parentId.trim() } : {}),
							})}
						>Grant</Button>
						<Button kind="ghost" onClick={props.onClose}>Cancel</Button>
					</div>
				</>
			)}
		</Modal>
	);
}
