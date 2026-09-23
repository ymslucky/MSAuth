import { useEffect, useMemo, useState } from "react";
import { Bot, ShieldOff } from "lucide-react";
import { api, del, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { navigate } from "../../router";
import { useOptimisticList } from "../../optimistic";
import { useTableState } from "../../table";
import {
	Badge, Button, Card, EmptyState, ErrorState, Field,
	MonoId, PageHeader, SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { Modal } from "../../dialog";
import { useNotice } from "../../notice-ui";
import { usePaletteSource, type PaletteEntry } from "../../palette-ui";

export interface AgentRow {
	id: string;
	name: string;
	description: string;
	clientId: string | null;
	dpopJkt: string | null;
	status: "active" | "revoked";
	createdAt: number;
}

export function Agents() {
	const t = useT();
	const notice = useNotice();
	const [items, setItems] = useState<AgentRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [creating, setCreating] = useState(false);
	const [saving, setSaving] = useState(false);
	const optimistic = useOptimisticList<AgentRow>(items, setItems);
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: AgentRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

	const reload = () => api<{ items: AgentRow[] }>("/api/v1/agents")
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

	async function revoke(id: string) {
		if (!(await notice.confirm({ title: t("Revoke this agent, its delegations and tokens?"), confirmLabel: t("Revoke") }))) return;
		// Optimistic: the badge flips to revoked instantly; failure rolls back + toasts.
		try {
			await optimistic.run(
				list => list.map(row => row.id === id ? { ...row, status: "revoked" as const } : row),
				() => del(`/api/v1/agents/${id}`),
			);
			notice.toast("success", t("Agent revoked."));
			void reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		}
	}

	// Palette: search loaded agents by name / description / client id.
	const paletteEntries = useMemo<PaletteEntry[] | null>(() => items === null ? null : items.map(row => ({
		id: `agent:${row.id}`,
		group: "resource",
		label: row.name,
		keywords: `${row.name} ${row.description} ${row.clientId ?? ""}`,
		icon: <Bot size={15} strokeWidth={1.75} aria-hidden />,
		perform: () => navigate("/agents"),
	})), [items]);
	usePaletteSource("agents", paletteEntries);

	return (
		<>
			<PageHeader
				title={t("Agents")}
				subtitle={t("Agent instances acting on your behalf. Each one is pinned to an OAuth client and a DPoP key fingerprint.")}
				crumbs={[{ label: t("Agents") }]}
				actions={<Button kind="primary" onClick={() => setCreating(true)}>{t("Register agent")}</Button>}
			/>
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<EmptyState
						art="agents"
						title={t("No agents registered.")}
						action={<Button kind="primary" onClick={() => setCreating(true)}>{t("Register agent")}</Button>}
					/>
				) : (
					<>
						<Table caption={t("Agents")} head={[t("Name"), t("Client"), t("DPoP key"), t("Status"), t("Created"), ""]} rightCols={[5]}>
							{table.rows.map(row => (
								<tr key={row.id}>
									<td>{row.name}{row.description && <div className="cell-sub">{row.description}</div>}</td>
									<td>{row.clientId ? <MonoId value={row.clientId} /> : <span className="muted">{t("not bound")}</span>}</td>
									<td>{row.dpopJkt ? <MonoId value={row.dpopJkt} /> : <span className="muted">—</span>}</td>
									<td>{row.status === "active" ? <Badge tone="ok">{t("active")}</Badge> : <Badge tone="bad">{t("revoked")}</Badge>}</td>
									<td className="muted"><When value={row.createdAt} /></td>
									<td className="right">
										{row.status === "active" && (
											<Button kind="danger" onClick={() => void revoke(row.id)}><ShieldOff size={14} strokeWidth={1.75} aria-hidden />{t("Revoke")}</Button>
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
			{creating && (
				<AgentForm pending={saving} onClose={() => setCreating(false)} onSave={input => {
					setSaving(true);
					void run(async () => {
						await post("/api/v1/agents", input);
						setCreating(false);
						notice.toast("success", t("Agent registered."));
					}).finally(() => setSaving(false));
				}} />
			)}
		</>
	);
}

function AgentForm(props: { pending: boolean; onClose: () => void; onSave: (input: { name: string; description: string; clientId?: string; publicJwk?: unknown }) => void }) {
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
				<Button kind="primary" busy={props.pending} disabled={!name.trim()} onClick={() => {
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
				<Button kind="ghost" disabled={props.pending} onClick={props.onClose}>{t("Cancel")}</Button>
			</div>
		</Modal>
	);
}
