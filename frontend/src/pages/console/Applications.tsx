import { useEffect, useMemo, useState } from "react";
import { AppWindow, Trash2 } from "lucide-react";
import { api, del, errorMessage, patch, post } from "../../api";
import { useT } from "../../i18n";
import { navigate } from "../../router";
import { useOptimisticList } from "../../optimistic";
import { useTableState } from "../../table";
import {
	Badge, Button, Card, EmptyState, ErrorNote, ErrorState, Field,
	MonoId, PageHeader, SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { Modal } from "../../dialog";
import { useNotice } from "../../notice-ui";
import { usePaletteSource, type PaletteEntry } from "../../palette-ui";
import { SecretReveal } from "./SecretReveal";

interface AppRow {
	client_id: string;
	client_name: string | null;
	redirect_uris: string[] | null;
	grant_types: string[] | null;
	disabled: number | null;
	userId: string | null;
	createdAt: number;
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
	const optimistic = useOptimisticList<AppRow>(items, setItems);
	// Client-side paging: any list can outgrow one screen.
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: AppRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

	const reload = () => api<{ items: AppRow[] }>("/api/v1/applications")
		.then(result => { setItems(result.items ?? []); setError(null); })
		.catch(cause => setError(errorMessage(cause)));
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
			setError(errorMessage(cause));
		}
	}

	/** Optimistic delete/rename: UI lands instantly; failure rolls back + error toast. */
	async function runOptimistic(mutate: (list: AppRow[]) => AppRow[], apiCall: () => Promise<unknown>, successMessage: string) {
		try {
			await optimistic.run(mutate, apiCall);
			notice.toast("success", successMessage);
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		}
	}

	const guardedRun = (title: string, action: () => Promise<unknown>, successMessage?: string) => {
		void (async () => {
			if (!(await notice.confirm({ title, confirmLabel: t("Confirm") }))) return;
			await run(action, successMessage);
		})();
	};

	// Palette: search loaded applications by name / client id.
	const paletteEntries = useMemo<PaletteEntry[] | null>(() => items === null ? null : items.map(row => ({
		id: `app:${row.client_id}`,
		group: "resource",
		label: row.client_name || row.client_id,
		keywords: `${row.client_name ?? ""} ${row.client_id}`,
		icon: <AppWindow size={15} strokeWidth={1.75} aria-hidden />,
		perform: () => navigate("/applications"),
	})), [items]);
	usePaletteSource("applications", paletteEntries);

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
					<EmptyState
						art="applications"
						title={t("No applications yet.")}
						hint={t("Applications are OAuth clients that sign in users or call APIs on your behalf.")}
						action={<Button kind="primary" onClick={() => setCreating(true)}>{t("New application")}</Button>}
					/>
				) : (
					<>
						<Table caption={t("Applications")} head={[t("Name"), t("Client ID"), t("Callbacks"), t("Status"), ""]} rightCols={[4]}>
							{table.rows.map(row => (
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
											const target = row;
											await runOptimistic(
												list => list.filter(item => item.client_id !== target.client_id),
												() => del(`/api/v1/applications/${target.client_id}`),
												t("Application deleted."),
											);
											void reload();
										})}><Trash2 size={14} strokeWidth={1.75} aria-hidden />{t("Delete")}</Button>
									</div>
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
						const target = editing;
						void runOptimistic(
							list => list.map(item => item.client_id === target.client_id
								? { ...item, client_name: input.name, redirect_uris: input.redirectUris }
								: item),
							() => patch(`/api/v1/applications/${target.client_id}`, input),
							t("Application updated."),
						).finally(() => {
							setSaving(false);
							setEditing(null);
						});
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
				<Button kind="primary" busy={props.pending} disabled={!name.trim() || !redirects.trim()} onClick={() => props.onSave({
					name: name.trim(),
					redirectUris: redirects.split("\n").map(value => value.trim()).filter(Boolean),
					confidential, dpop,
				})}>{t("Save")}</Button>
				<Button kind="ghost" disabled={props.pending} onClick={props.onClose}>{t("Cancel")}</Button>
			</div>
		</Modal>
	);
}
