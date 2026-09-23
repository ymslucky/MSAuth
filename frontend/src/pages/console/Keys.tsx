import { useEffect, useMemo, useState } from "react";
import { KeyRound, ShieldOff } from "lucide-react";
import { api, del, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { navigate } from "../../router";
import { useOptimisticList } from "../../optimistic";
import { useTableState } from "../../table";
import {
	Button, Card, EmptyState, ErrorState, Field,
	MonoId, PageHeader, SkeletonTable, Table, TablePager, When,
} from "../../ui";
import { Modal } from "../../dialog";
import { useNotice } from "../../notice-ui";
import { usePaletteSource, type PaletteEntry } from "../../palette-ui";
import { SecretReveal } from "./SecretReveal";

interface KeyRow {
	id: string;
	name: string | null;
	start: string | null;
	createdAt: number;
	expiresAt: number | null;
	enabled: boolean | null;
	lastRequestAt: number | null;
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
	const optimistic = useOptimisticList<KeyRow>(items, setItems);
	const table = useTableState(items ?? [], {
		accessors: { createdAt: (row: KeyRow) => row.createdAt },
		initialSort: { key: "createdAt", dir: "desc" },
		pageSize: 25,
	});

	const reload = () => api<{ apiKeys: KeyRow[] }>("/api/v1/keys")
		.then(result => { setItems(result.apiKeys ?? []); setError(null); })
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
		if (!(await notice.confirm({ title: t("Revoke this key?"), confirmLabel: t("Revoke") }))) return;
		// Optimistic: the row disappears immediately; failure rolls back + toasts.
		try {
			await optimistic.run(list => list.filter(row => row.id !== id), () => del(`/api/v1/keys/${id}`));
			notice.toast("success", t("API key revoked."));
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		}
	}

	// Palette: search loaded keys by name / key prefix.
	const paletteEntries = useMemo<PaletteEntry[] | null>(() => items === null ? null : items.map(row => ({
		id: `key:${row.id}`,
		group: "resource",
		label: row.name || row.start || row.id,
		keywords: `${row.name ?? ""} ${row.start ?? ""} ${row.id}`,
		icon: <KeyRound size={15} strokeWidth={1.75} aria-hidden />,
		perform: () => navigate("/keys"),
	})), [items]);
	usePaletteSource("keys", paletteEntries);

	return (
		<>
			<PageHeader
				title={t("API keys")}
				subtitle={t("Personal automation keys. 30-day expiry, 60 requests per minute.")}
				crumbs={[{ label: t("Developer") }, { label: t("API keys") }]}
				actions={<Button kind="primary" onClick={() => setCreating(true)}>{t("New key")}</Button>}
			/>
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<EmptyState
						art="keys"
						title={t("No API keys.")}
						action={<Button kind="primary" onClick={() => setCreating(true)}>{t("New key")}</Button>}
					/>
				) : (
					<>
					<Table caption={t("API keys")} head={[t("Name"), t("Key"), t("Created"), t("Expires"), t("Last used"), ""]} rightCols={[5]}>
						{table.rows.map(row => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td><MonoId value={`${row.start ?? row.id}…`} /></td>
								<td className="muted"><When value={row.createdAt} /></td>
								<td className="muted"><When value={row.expiresAt} /></td>
								<td className="muted"><When value={row.lastRequestAt} /></td>
								<td className="right"><Button kind="danger" onClick={() => void revoke(row.id)}><ShieldOff size={14} strokeWidth={1.75} aria-hidden />{t("Revoke")}</Button></td>
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
				<Button kind="primary" busy={props.pending} disabled={!name.trim()} onClick={() => props.onSave(name.trim())}>{t("Create")}</Button>
			</div>
		</>
	);
}
