/**
 * Table state — ONE module for every list view: chip filter → sort → paginate.
 * The pure pipeline below is tested in test/frontend/table.test.ts; the thin
 * React wrapper at the bottom keeps table pages declarative (sort toggles and
 * page state live here, never per-page).
 */
import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortSpec {
	key: string;
	dir: SortDir;
}

/** Two-state cycling: a new column starts asc; the same column flips. */
export function nextSort(current: SortSpec | null, key: string): SortSpec {
	return current !== null && current.key === key
		? { key, dir: current.dir === "asc" ? "desc" : "asc" }
		: { key, dir: "asc" };
}

export type Accessors<T> = Record<string, (row: T) => string | number | null>;

/** Stable accessor sort; columns without an accessor are not sortable; nullish values sink. */
export function sortRows<T>(rows: readonly T[], sort: SortSpec | null, accessors: Accessors<T>): T[] {
	if (sort === null || !accessors[sort.key]) return [...rows];
	const accessor = accessors[sort.key];
	const factor = sort.dir === "asc" ? 1 : -1;
	return [...rows].sort((a, b) => {
		const va = accessor(a);
		const vb = accessor(b);
		if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
		if (vb === null || vb === undefined) return -1;
		if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
		return String(va).localeCompare(String(vb)) * factor;
	});
}

/** Keep rows matching ANY active chip key; with no active chips everything passes. */
export function filterRows<T>(
	rows: readonly T[],
	active: ReadonlySet<string>,
	match: (row: T, key: string) => boolean,
): T[] {
	if (active.size === 0) return [...rows];
	return rows.filter(row => {
		for (const key of active) if (match(row, key)) return true;
		return false;
	});
}

/** One page slice with a 1-based inclusive range — the "x–y / z" label. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): {
	rows: T[];
	start: number;
	end: number;
	total: number;
	pages: number;
} {
	const total = rows.length;
	const pages = Math.max(1, Math.ceil(total / pageSize));
	const first = (page - 1) * pageSize;
	const slice = rows.slice(first, first + pageSize);
	return {
		rows: slice,
		start: slice.length > 0 ? first + 1 : 0,
		end: slice.length > 0 ? first + slice.length : 0,
		total,
		pages,
	};
}

/** Floor at 1, cap at the last page; empty sets always sit on page 1. */
export function clampPage(total: number, page: number, pageSize: number): number {
	const pages = Math.max(1, Math.ceil(total / pageSize));
	return Math.min(Math.max(1, page), pages);
}

/** Total row count (server-paged) → page count, floored at 1 for the pager. */
export function pageCount(total: number, pageSize: number): number {
	return Math.max(1, Math.ceil(total / pageSize));
}

/** Immutable chip toggle: add the key when missing, remove it when present. */
export function toggledSet(active: ReadonlySet<string>, key: string): Set<string> {
	const next = new Set(active);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	return next;
}

export interface TableViewOptions<T> {
	sort: SortSpec | null;
	accessors: Accessors<T>;
	active?: ReadonlySet<string>;
	match?: (row: T, key: string) => boolean;
	page: number;
	pageSize: number;
}

/** The full pipeline the hook renders from: filter → sort → paginate. */
export function tableView<T>(rows: readonly T[], opts: TableViewOptions<T>): {
	rows: T[];
	total: number;
	start: number;
	end: number;
	pages: number;
	page: number;
} {
	const filtered = opts.active && opts.match
		? filterRows(rows, opts.active, opts.match)
		: [...rows];
	const sorted = sortRows(filtered, opts.sort, opts.accessors);
	const page = clampPage(sorted.length, opts.page, opts.pageSize);
	const result = paginate(sorted, page, opts.pageSize);
	return { ...result, page };
}

export interface TableState<T> {
	/** Rows of the current page, after filter + sort. */
	rows: T[];
	total: number;
	start: number;
	end: number;
	pages: number;
	page: number;
	setPage: (page: number) => void;
	sort: SortSpec | null;
	toggleSort: (key: string) => void;
}

/**
 * React wrapper over the pure pipeline. `filterKey` is a cheap string the page
 * derives from its chip set (and query inputs) — any change, like a sort
 * toggle, resets the page to 1.
 */
export function useTableState<T>(
	rows: readonly T[],
	opts: {
		accessors: Accessors<T>;
		pageSize?: number;
		initialSort?: SortSpec | null;
		active?: ReadonlySet<string>;
		match?: (row: T, key: string) => boolean;
		filterKey?: string;
	},
): TableState<T> {
	const pageSize = opts.pageSize ?? 25;
	const [page, setPage] = useState(1);
	const [sort, setSort] = useState<SortSpec | null>(opts.initialSort ?? null);
	const [prevFilterKey, setPrevFilterKey] = useState(opts.filterKey);

	// Render-phase reset (React's recommended adjust-state-on-prop-change
	// pattern): a new filter context must not strand the user on page 4.
	if (prevFilterKey !== opts.filterKey) {
		setPrevFilterKey(opts.filterKey);
		setPage(1);
	}

	const view = useMemo(
		() => tableView(rows, { sort, accessors: opts.accessors, active: opts.active, match: opts.match, page, pageSize }),
		[rows, sort, page, pageSize, opts.accessors, opts.active, opts.match],
	);

	const toggleSort = useMemo(
		() => (key: string) => {
			setSort(current => nextSort(current, key));
			setPage(1);
		},
		[],
	);

	return {
		rows: view.rows,
		total: view.total,
		start: view.start,
		end: view.end,
		pages: view.pages,
		page: view.page,
		setPage,
		sort,
		toggleSort,
	};
}
