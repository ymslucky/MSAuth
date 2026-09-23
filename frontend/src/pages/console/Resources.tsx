import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { api, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { navigate } from "../../router";
import { useTableState } from "../../table";
import {
	Badge, Button, Card, EmptyState, ErrorState, Field,
	MonoId, PageHeader, SkeletonTable, Table, TablePager,
} from "../../ui";
import { useNotice } from "../../notice-ui";
import { usePaletteSource, type PaletteEntry } from "../../palette-ui";

interface ResourceRow {
	id: string;
	identifier: string;
	name: string;
	accessTokenTtl: number | null;
	allowedScopes: string | null;
	dpopBoundAccessTokensRequired: number | null;
	disabled: number | null;
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
	const table = useTableState(items ?? [], { accessors: {}, pageSize: 25 });

	// Palette: search loaded resources by name / identifier.
	const paletteEntries = useMemo<PaletteEntry[] | null>(() => items === null ? null : items.map(row => ({
		id: `resource:${row.id}`,
		group: "resource",
		label: row.name,
		keywords: `${row.name} ${row.identifier}`,
		icon: <Globe size={15} strokeWidth={1.75} aria-hidden />,
		perform: () => navigate("/resources"),
	})), [items]);
	usePaletteSource("resources", paletteEntries);

	const reload = () => api<{ items: ResourceRow[] }>("/api/v1/resources")
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

	return (
		<>
			<PageHeader
				title={t("Resources")}
				subtitle={t("HTTPS APIs (e.g. MCP servers) that accept MSAuth tokens. Token audience is pinned to the exact identifier.")}
				crumbs={[{ label: t("Developer") }, { label: t("Resources") }]}
			/>
			<Card>
				{items === null ? (error
					? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
					: <SkeletonTable />
				) : items.length === 0 ? (
					<EmptyState art="applications" title={t("No resources registered.")} />
				) : (
					<>
					<Table caption={t("Resources")} head={[t("Name"), t("Identifier"), t("TTL"), t("DPoP required"), t("Status")]}>
						{table.rows.map(row => (
							<tr key={row.id}>
								<td>{row.name}</td>
								<td>
									<span className="cell-res">
										<MonoId value={row.identifier} wide mask={false} />
										<a className="ext-link" href={row.identifier} target="_blank" rel="noreferrer" aria-label={`${t("Open resource")}: ${row.identifier}`}>
											<ExternalLink size={12} strokeWidth={1.75} aria-hidden />
										</a>
									</span>
								</td>
								<td className="mono muted">{row.accessTokenTtl ?? 300}s</td>
								<td>{row.dpopBoundAccessTokensRequired ? t("yes") : t("no")}</td>
								<td>{row.disabled ? <Badge tone="bad">{t("disabled")}</Badge> : <Badge tone="ok">{t("active")}</Badge>}</td>
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
			{props.operator && (
				<>
					<Card title={t("Register resource")}>
						<div className="field-row">
							<Field label={t("Identifier")}><input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="https://mcp.example.com/mcp" spellCheck={false} /></Field>
							<Field label={t("Name")}><input value={name} onChange={event => setName(event.target.value)} placeholder="Notes MCP" /></Field>
						</div>
						<Button kind="primary" busy={saving} disabled={!identifier.trim() || !name.trim()} onClick={() => {
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
						<Button kind="primary" busy={saving} disabled={!linkTarget.identifier.trim() || !linkTarget.clientId.trim()} onClick={() => {
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
