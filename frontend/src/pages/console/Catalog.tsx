import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { useT } from "../../i18n";
import { sparklineGeometry } from "../../viz";
import { EMPTY_ARTS } from "../../illustrations";
import {
	ActionTag, Badge, Button, Card, CopyButton, EmptyState, Field, FilterChips,
	Modal, MonoId, PageHeader, RESOURCE_TONES, Skeleton, SkeletonProfile, SkeletonStats,
	SkeletonTable, Table, TablePager, palettePlatformKey, useNotice, usePalette,
} from "../../ui";
import { useTableState } from "../../table";

/** Sample rows for the table-toolbar demo (3 per page, so the pager shows). */
interface DemoRow { id: string; name: string; createdAt: number }
const DEMO_ROWS: DemoRow[] = ["alpha", "beta", "gamma", "delta", "epsilon"].map((name, index) => ({
	id: `demo-${index}`, name, createdAt: Date.now() - index * 3_600_000,
}));

function ButtonsSection() {
	const t = useT();
	return (
		<Card title={t("Buttons")}>
			<div className="btn-row">
				<Button>default</Button>
				<Button kind="primary">primary</Button>
				<Button kind="danger">danger</Button>
				<Button kind="danger-solid">danger-solid</Button>
				<Button kind="ghost">ghost</Button>
			</div>
			<div className="btn-row">
				<Button busy>busy</Button>
				<Button disabled>disabled</Button>
				<Button kind="primary" disabled>primary disabled</Button>
			</div>
		</Card>
	);
}

function TagsSection() {
	const t = useT();
	return (
		<Card title={t("Tags & badges")}>
			<div className="btn-row">
				{RESOURCE_TONES.map(tone => <span key={tone} className={`tag tag--${tone}`}>{tone}</span>)}
			</div>
			<div className="btn-row">
				<Badge>neutral</Badge>
				<Badge tone="ok">ok</Badge>
				<Badge tone="warn">warn</Badge>
				<Badge tone="bad">bad</Badge>
				<ActionTag code="token.exchanged" />
				<ActionTag code="unknown.code" />
			</div>
			<div className="btn-row">
				<FilterChips
					ariaLabel={t("Filter by type")}
					chips={[
						{ key: "agent", label: "agent", tone: "agent" },
						{ key: "session", label: "session", tone: "session" },
					]}
					active={new Set(["agent"])}
					onToggle={() => undefined}
				/>
			</div>
		</Card>
	);
}

function DialogSection() {
	const t = useT();
	const notice = useNotice();
	const [modal, setModal] = useState(false);
	return (
		<Card title={t("Dialogs")}>
			<div className="btn-row">
				<Button onClick={() => setModal(true)}>{t("Open modal")}</Button>
				<Button onClick={() => void notice.confirm({ title: t("Delete everything?"), confirmLabel: t("Confirm") }).then(ok => notice.toast(ok ? "success" : "info", ok ? t("Confirmed") : t("Cancelled")))}>
					{t("Open confirm")}
				</Button>
			</div>
			<Modal title={t("Open modal")} open={modal} onClose={() => setModal(false)}>
				<p className="confirm-body">{t("This is a modal.")}</p>
				<Field label={t("Name")}><input /></Field>
				<div className="btn-row">
					<Button kind="primary" onClick={() => setModal(false)}>{t("Close")}</Button>
				</div>
			</Modal>
		</Card>
	);
}

function ToastSection() {
	const t = useT();
	const notice = useNotice();
	return (
		<Card title={t("Toasts")}>
			<div className="btn-row">
				<Button onClick={() => notice.toast("success", t("Settings saved."))}>{t("Fire success toast")}</Button>
				<Button onClick={() => notice.toast("error", t("Something went wrong."))}>{t("Fire error toast")}</Button>
				<Button onClick={() => notice.toast("info", t("Copied"))}>{t("Fire info toast")}</Button>
				<Button onClick={() => notice.toast("info", t("Application created."), { actionLabel: t("Undo"), onAction: () => notice.toast("success", t("Done")) })}>
					{t("Toast with action")}
				</Button>
			</div>
		</Card>
	);
}

function CopySection() {
	const t = useT();
	const value = "b3f1c9de-4a2e-4c8b-9f01-example0000";
	return (
		<Card title={t("Copy & identifiers")}>
			<div className="btn-row">
				<CopyButton value={value} />
				<MonoId value={value} />
				<MonoId value={value} mask={false} />
				<MonoId value={value} wide />
			</div>
			<p className="muted">{t("Masked by default;")} <code>mask={"{false}"}</code> {t("shows the value in full.")}</p>
		</Card>
	);
}

function SkeletonSection() {
	const t = useT();
	return (
		<Card title={t("Skeletons")}>
			<Skeleton style={{ width: "40%" }} />
			<div style={{ margin: "14px 0" }}><SkeletonStats count={2} /></div>
			<SkeletonTable rows={3} />
			<div style={{ marginTop: 14 }}><SkeletonProfile cells={2} /></div>
		</Card>
	);
}

function EmptySection() {
	const t = useT();
	return (
		<Card title={t("Empty states")}>
			<div className="empty-catalog">
				{EMPTY_ARTS.map(art => (
					<EmptyState key={art} art={art} title={art} />
				))}
			</div>
			<EmptyState
				art="keys"
				title={t("No API keys.")}
				hint={t("A hint line under the title.")}
				action={<Button kind="primary">{t("New key")}</Button>}
			/>
		</Card>
	);
}

function TableToolbarSection() {
	const t = useT();
	const [active, setActive] = useState<ReadonlySet<string>>(new Set());
	const table = useTableState(DEMO_ROWS, {
		accessors: { name: (row: DemoRow) => row.name, createdAt: (row: DemoRow) => row.createdAt },
		pageSize: 3,
		initialSort: { key: "createdAt", dir: "desc" },
		active,
		match: (row: DemoRow, key: string) => row.name === key,
	});
	return (
		<Card title={t("Table toolbar")}>
			<FilterChips
				ariaLabel={t("Filter by type")}
				chips={DEMO_ROWS.slice(0, 3).map(row => ({ key: row.name, label: row.name }))}
				active={active}
				onToggle={key => setActive(current => {
					const next = new Set(current);
					if (next.has(key)) next.delete(key); else next.add(key);
					return next;
				})}
			/>
			<Table
				sort={{ spec: table.sort, onToggle: table.toggleSort }}
				head={[{ label: t("Name"), sortKey: "name" }, { label: t("Created"), sortKey: "createdAt" }]}
			>
				{table.rows.map(row => (
					<tr key={row.id}>
						<td>{row.name}</td>
						<td className="muted mono">{new Date(row.createdAt).toISOString()}</td>
					</tr>
				))}
			</Table>
			<TablePager page={table.page} pages={table.pages} start={table.start} end={table.end} total={table.total} onPage={table.setPage} />
		</Card>
	);
}

function PaletteSection() {
	const t = useT();
	const { setOpen } = usePalette();
	return (
		<Card title={t("Palette & preferences")}>
			<div className="btn-row">
				<Button onClick={() => setOpen(true)}><Bot size={14} strokeWidth={1.75} aria-hidden />{t("Open palette")}</Button>
				<kbd className="palette-kbd" aria-hidden="true">{palettePlatformKey()}</kbd>
				<Button ariaLabel={t("Search")} onClick={() => setOpen(true)}><Send size={14} strokeWidth={1.75} aria-hidden />trigger</Button>
			</div>
		</Card>
	);
}

function VizSection() {
	const t = useT();
	const geo = sparklineGeometry([2, 5, 3, 8, 6, 9, 4], 320, 64, 4);
	const last = geo.points[geo.points.length - 1];
	return (
		<Card title={t("Data viz")}>
			<svg viewBox="0 0 320 64" className="spark" role="img" aria-label={t("Token exchange trend (7 days)")}>
				<path d={geo.area} className="spark-area" />
				<path d={geo.line} className="spark-line" />
				{last && <circle cx={last.x} cy={last.y} r="3" className="spark-dot" />}
			</svg>
			<div className="btn-row">
				{RESOURCE_TONES.map(tone => <span key={tone} className={`dot dot--${tone}`} title={tone} />)}
			</div>
		</Card>
	);
}

/** Documentation-as-code: every primitive, every state — at /dev, linked nowhere. */
export default function Catalog() {
	const t = useT();
	return (
		<>
			<PageHeader
				title={t("Component catalog")}
				subtitle={t("Documentation-as-code: every primitive, every state.")}
				crumbs={[{ label: t("Developer") }, { label: t("Component catalog") }]}
			/>
			<div className="inner-cap">
				<ButtonsSection />
				<TagsSection />
				<DialogSection />
				<ToastSection />
				<CopySection />
				<SkeletonSection />
				<EmptySection />
				<TableToolbarSection />
				<PaletteSection />
				<VizSection />
			</div>
		</>
	);
}
