import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { api, del, fmtDate, fullTimestamp, isValidExpiry, post } from "../../api";
import { useT } from "../../i18n";
import {
	Badge, Button, Card, Empty, ErrorNote, ErrorState, Field,
	Modal, MonoId, PageHeader, SkeletonTable, Table, useNotice,
} from "../../ui";

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
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<AgentRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [creating, setCreating] = useState(false);
	const [revoking, setRevoking] = useState(false);

	const reload = () => api<{ items: AgentRow[] }>("/api/v1/agents")
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

	async function revoke(id: string) {
		setError(null);
		if (!(await notice.confirm({ title: t("Revoke this agent, its delegations and tokens?"), confirmLabel: t("Revoke") }))) return;
		setRevoking(true);
		try {
			await del(`/api/v1/agents/${id}`);
			notice.toast("success", t("Agent revoked."));
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
				title={t("Agents")}
				subtitle={t("Agent instances acting on your behalf. Each one is pinned to an OAuth client and a DPoP key fingerprint.")}
				crumbs={[{ label: t("Agents") }]}
				actions={<Button kind="primary" onClick={() => setCreating(true)}>{t("Register agent")}</Button>}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<Empty glyph="&" action={<Button kind="primary" onClick={() => setCreating(true)}>{t("Register agent")}</Button>}>
						{t("No agents registered.")}
					</Empty>
				) : (
					<Table head={[t("Name"), t("Client"), t("DPoP key"), t("Status"), t("Created"), ""]} rightCols={[5]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.name}{row.description && <div className="cell-sub">{row.description}</div>}</td>
								<td>{row.clientId ? <MonoId value={row.clientId} /> : <span className="muted">{t("not bound")}</span>}</td>
								<td>{row.dpopJkt ? <MonoId value={row.dpopJkt} /> : <span className="muted">—</span>}</td>
								<td>{row.status === "active" ? <Badge tone="ok">{t("active")}</Badge> : <Badge tone="bad">{t("revoked")}</Badge>}</td>
								<td className="muted"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
								<td className="right">
										{row.status === "active" && (
											<Button kind="danger" disabled={revoking} onClick={() => void revoke(row.id)}><ShieldOff size={14} strokeWidth={1.75} aria-hidden />{t("Revoke")}</Button>
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
					notice.toast("success", t("Agent registered."));
				})} />
			)}
		</>
	);
}

function AgentForm(props: { onClose: () => void; onSave: (input: { name: string; description: string; clientId?: string; publicJwk?: unknown }) => void }) {
	const t = useT();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [clientId, setClientId] = useState("");
	const [publicJwk, setPublicJwk] = useState("");
	const [jwkError, setJwkError] = useState<string | null>(null);
	// Validation fires on blur (or submit), never on each keystroke.
	const validateJwk = (value: string): string | null => {
		if (!value.trim()) return null;
		try {
			JSON.parse(value);
			return null;
		} catch {
			return t("Public key must be valid JSON");
		}
	};
	return (
		<Modal title={t("Register agent")} open onClose={props.onClose}>
			<Field label={t("Name")} count={`${name.length}/100`} required>
				<input value={name} onChange={event => setName(event.target.value)} maxLength={100} />
			</Field>
			<Field label={t("Description")} count={`${description.length}/500`}>
				<input value={description} onChange={event => setDescription(event.target.value)} maxLength={500} />
			</Field>
			<Field label={t("OAuth client ID")} hint={t("Optional now — the agent can also self-register via DCR later.")}>
				<input value={clientId} onChange={event => setClientId(event.target.value)} spellCheck={false} />
			</Field>
			<Field label={t("Agent public key (P-256 JWK)")} hint={t("Public key only. Tokens will be DPoP-bound to its thumbprint.")} error={jwkError}>
				<textarea
					rows={4}
					value={publicJwk}
					onChange={event => setPublicJwk(event.target.value)}
					onBlur={() => setJwkError(validateJwk(publicJwk))}
					spellCheck={false}
					placeholder='{"kty":"EC","crv":"P-256","x":"…","y":"…"}'
				/>
			</Field>
			<div className="btn-row">
				<Button kind="primary" disabled={!name.trim()} onClick={() => {
					const jwkErrorAtSubmit = validateJwk(publicJwk);
					if (jwkErrorAtSubmit) {
						setJwkError(jwkErrorAtSubmit);
						return;
					}
					props.onSave({
						name: name.trim(), description: description.trim(),
						...(clientId.trim() && publicJwk.trim() ? { clientId: clientId.trim(), publicJwk: JSON.parse(publicJwk) } : {}),
					});
				}}>{t("Register")}</Button>
				<Button kind="ghost" onClick={props.onClose}>{t("Cancel")}</Button>
			</div>
		</Modal>
	);
}

export function Delegations() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<DelegationRow[] | null>(null);
	const [agents, setAgents] = useState<AgentRow[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [creating, setCreating] = useState(false);
	const [revoking, setRevoking] = useState(false);

	const reload = () => api<{ items: DelegationRow[] }>("/api/v1/delegations")
		.then(result => { setItems(result.items ?? []); setError(null); })
		.catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	useEffect(() => {
		setItems(null);
		void reload();
		api<{ items: AgentRow[] }>("/api/v1/agents").then(result => setAgents((result.items ?? []).filter(agent => agent.status === "active" && agent.clientId && agent.dpopJkt))).catch(() => undefined);
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
		if (!(await notice.confirm({ title: t("Revoke this delegation (and any children)?"), confirmLabel: t("Revoke") }))) return;
		setRevoking(true);
		try {
			await del(`/api/v1/delegations/${id}`);
			notice.toast("success", t("Delegation revoked."));
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
				title={t("Delegations")}
				subtitle={t("Explicit consent for an agent to act as you on one resource. Authority only ever narrows, up to 4 hops.")}
				crumbs={[{ label: t("Agents") }, { label: t("Delegations") }]}
				actions={<Button kind="primary" onClick={() => setCreating(true)}>{t("New delegation")}</Button>}
			/>
			<ErrorNote message={items === null && error ? null : error} />
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<Empty glyph="%" action={<Button kind="primary" onClick={() => setCreating(true)}>{t("New delegation")}</Button>}>
						{t("No delegations.")}
					</Empty>
				) : (
					<Table head={[t("Agent"), t("Resource"), t("Scopes / permissions"), t("Depth"), t("Expires"), t("Status"), ""]} rightCols={[6]}>
						{items.map(row => (
							<tr key={row.id}>
								<td>{row.agentName}</td>
								<td><MonoId value={row.resource} wide mask={false} /></td>
								<td>{row.scopes.join(", ")}<div className="cell-sub mono">{JSON.stringify(row.authorizationDetails)}</div></td>
								<td>{row.depth}{row.depth > 0 && <div className="cell-sub">{t("chain")}</div>}</td>
								<td className="muted"><time title={fullTimestamp(row.expiresAt)}>{fmtDate(row.expiresAt)}</time></td>
								<td>{row.revokedAt ? <Badge tone="bad">{t("revoked")}</Badge> : row.expiresAt < Date.now() ? <Badge tone="warn">{t("expired")}</Badge> : <Badge tone="ok">{t("live")}</Badge>}</td>
								<td className="right">
										{!row.revokedAt && (
											<Button kind="danger" disabled={revoking} onClick={() => void revoke(row.id)}><ShieldOff size={14} strokeWidth={1.75} aria-hidden />{t("Revoke")}</Button>
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
					notice.toast("success", t("Delegation granted."));
				})} />
			)}
		</>
	);
}

function DelegationForm(props: { agents: AgentRow[]; onClose: () => void; onSave: (input: Record<string, unknown>) => void }) {
	const t = useT();
	const [agentId, setAgentId] = useState(props.agents[0]?.id ?? "");
	const [resource, setResource] = useState("");
	const [scopes, setScopes] = useState<string[]>(["mcp:invoke"]);
	const [parentId, setParentId] = useState("");
	const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
	const [expiryError, setExpiryError] = useState<string | null>(null);
	const bindable = props.agents.length > 0;
	const submit = () => {
		if (!isValidExpiry(expiresAt)) {
			setExpiryError(t("Expiry must be between one minute and 30 days from now."));
			return;
		}
		props.onSave({
			agentId,
			resource: resource.trim(),
			scopes,
			expiresAt: new Date(expiresAt).getTime(),
			...(parentId.trim() ? { parentId: parentId.trim() } : {}),
		});
	};
	return (
		<Modal title={t("New delegation")} open onClose={props.onClose}>
			{!bindable ? (
				<>
					<p className="muted">{t("Register an agent bound to an OAuth client and a DPoP key first — a delegation needs both.")}</p>
					<Button onClick={props.onClose}>{t("Close")}</Button>
				</>
			) : (
				<>
					<Field label={t("Agent")}>
						<select value={agentId} onChange={event => setAgentId(event.target.value)}>
							{props.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
						</select>
					</Field>
					<Field label={t("Resource identifier")}><input value={resource} onChange={event => setResource(event.target.value)} placeholder="https://mcp.example.com/mcp" spellCheck={false} /></Field>
					<div className="field">
						<span>{t("Scopes")}</span>
						{AGENT_SCOPES.map(scope => (
							<label key={scope} className="check-row">
								<input
									type="checkbox"
									checked={scopes.includes(scope)}
									onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope))}
								/>
								<code>{scope}</code>
							</label>
						))}
					</div>
					<Field label={t("Parent delegation (optional)")} hint={t("Children may only narrow the parent's authority and expiry.")}>
						<input value={parentId} onChange={event => setParentId(event.target.value)} spellCheck={false} />
					</Field>
					<Field
						label={t("Expires at")}
						hint={t("Between one minute and 30 days from now.")}
						error={expiryError}
						required
					>
						<input
							type="datetime-local"
							value={expiresAt}
							onChange={event => setExpiresAt(event.target.value)}
							onBlur={() => { if (expiresAt && !isValidExpiry(expiresAt)) setExpiryError(t("Expiry must be between one minute and 30 days from now.")); }}
						/>
					</Field>
					<div className="btn-row">
						<Button
							kind="primary"
							disabled={!agentId || !resource.trim() || scopes.length === 0}
							onClick={submit}
						>{t("Grant")}</Button>
						<Button kind="ghost" onClick={props.onClose}>{t("Cancel")}</Button>
					</div>
				</>
			)}
		</Modal>
	);
}
