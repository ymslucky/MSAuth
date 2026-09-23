import { describe, expect, it } from "vitest";
import {
	clampPage,
	filterRows,
	nextSort,
	paginate,
	sortRows,
	tableView,
	type SortSpec,
} from "../../frontend/src/table";

const byCreated = { createdAt: (row: { createdAt: number }) => row.createdAt };
const rows = [
	{ id: "a", createdAt: 30 },
	{ id: "b", createdAt: 10 },
	{ id: "c", createdAt: 20 },
];

describe("nextSort — two-state column cycling", () => {
	it("starts ascending on a new column", () => {
		expect(nextSort(null, "createdAt")).toEqual({ key: "createdAt", dir: "asc" });
	});

	it("flips to desc on the same column", () => {
		const current: SortSpec = { key: "createdAt", dir: "asc" };
		expect(nextSort(current, "createdAt")).toEqual({ key: "createdAt", dir: "desc" });
	});

	it("cycles back to asc after desc", () => {
		const current: SortSpec = { key: "createdAt", dir: "desc" };
		expect(nextSort(current, "createdAt")).toEqual({ key: "createdAt", dir: "asc" });
	});

	it("switching columns restarts ascending", () => {
		const current: SortSpec = { key: "createdAt", dir: "desc" };
		expect(nextSort(current, "name")).toEqual({ key: "name", dir: "asc" });
	});
});

describe("sortRows — accessor-based, stable, nullish sinks", () => {
	it("sorts numbers numerically ascending", () => {
		const sorted = sortRows(rows, { key: "createdAt", dir: "asc" }, byCreated);
		expect(sorted.map(row => row.id)).toEqual(["b", "c", "a"]);
	});

	it("flips direction on desc", () => {
		const sorted = sortRows(rows, { key: "createdAt", dir: "desc" }, byCreated);
		expect(sorted.map(row => row.id)).toEqual(["a", "c", "b"]);
	});

	it("ignores columns without an accessor (order untouched)", () => {
		expect(sortRows(rows, { key: "ghost", dir: "asc" }, byCreated)).toEqual(rows);
	});

	it("keeps the original order for equal keys (stable)", () => {
		const tied = [
			{ id: "x", createdAt: 5 },
			{ id: "y", createdAt: 5 },
			{ id: "z", createdAt: 5 },
		];
		expect(sortRows(tied, { key: "createdAt", dir: "asc" }, byCreated).map(row => row.id))
			.toEqual(["x", "y", "z"]);
	});

	it("compares strings via collation, not code units", () => {
		const people = [{ name: "bob" }, { name: "Alice" }];
		const sorted = sortRows(people, { key: "name", dir: "asc" }, { name: row => row.name });
		expect(sorted.map(row => row.name)).toEqual(["Alice", "bob"]);
	});

	it("sinks nullish values to the bottom regardless of direction", () => {
		const withGaps = [
			{ id: "a", createdAt: 5 },
			{ id: "b", createdAt: 0 },
			{ id: "c", createdAt: 9 },
		];
		const accessors = { createdAt: (row: { id: string; createdAt: number }) => (row.createdAt === 0 ? null : row.createdAt) };
		expect(sortRows(withGaps, { key: "createdAt", dir: "asc" }, accessors).map(row => row.id)).toEqual(["a", "c", "b"]);
		expect(sortRows(withGaps, { key: "createdAt", dir: "desc" }, accessors).map(row => row.id)).toEqual(["c", "a", "b"]);
	});
});

describe("filterRows — chip predicate with any-match semantics", () => {
	const users = [
		{ id: "u1", banned: false },
		{ id: "u2", banned: true },
		{ id: "u3", banned: false },
	];
	const match = (row: { banned: boolean }, key: string): boolean => key === "banned" ? row.banned : !row.banned;

	it("no active chips keeps every row", () => {
		expect(filterRows(users, new Set(), match)).toEqual(users);
	});

	it("keeps rows matching any active chip", () => {
		const result = filterRows(users, new Set(["banned"]), match);
		expect(result.map(row => row.id)).toEqual(["u2"]);
		expect(filterRows(users, new Set(["active", "banned"]), match)).toHaveLength(3);
	});
});

describe("paginate — 1-based inclusive range for the x–y / z label", () => {
	it("slices the requested page and reports the range", () => {
		const page = paginate([1, 2, 3, 4, 5], 2, 2);
		expect(page.rows).toEqual([3, 4]);
		expect(page.start).toBe(3);
		expect(page.end).toBe(4);
		expect(page.total).toBe(5);
		expect(page.pages).toBe(3);
	});

	it("clamps a partial final page range to the real row count", () => {
		const page = paginate([1, 2, 3], 2, 2);
		expect(page.rows).toEqual([3]);
		expect(page.start).toBe(3);
		expect(page.end).toBe(3);
	});

	it("an out-of-range page yields empty rows with a clamped range", () => {
		const page = paginate([1, 2], 9, 2);
		expect(page.rows).toEqual([]);
		expect(page.start).toBe(0);
		expect(page.end).toBe(0);
		expect(page.pages).toBe(1);
	});
});

describe("clampPage", () => {
	it("floors at 1 and caps at the last page", () => {
		expect(clampPage(10, 0, 25)).toBe(1);
		expect(clampPage(10, 99, 25)).toBe(1);
		expect(clampPage(51, 99, 25)).toBe(3);
	});

	it("always yields page 1 for empty row sets", () => {
		expect(clampPage(0, 5, 25)).toBe(1);
	});
});

describe("tableView — filter → sort → paginate composition", () => {
	const audit = [
		{ id: "1", type: "agent", createdAt: 3 },
		{ id: "2", type: "apikey", createdAt: 1 },
		{ id: "3", type: "agent", createdAt: 2 },
		{ id: "4", type: "user", createdAt: 4 },
	];
	const accessors = { createdAt: (row: typeof audit[number]) => row.createdAt };
	const match = (row: typeof audit[number], key: string) => row.type === key;

	it("composes chips, sort and pagination in that order", () => {
		const view = tableView(audit, {
			active: new Set(["agent"]),
			match,
			sort: { key: "createdAt", dir: "desc" },
			accessors,
			page: 1,
			pageSize: 2,
		});
		expect(view.rows.map(row => row.id)).toEqual(["1", "3"]);
		expect(view.total).toBe(2); // post-filter total drives the pager label
		expect(view.pages).toBe(1);
	});

	it("total reflects the filtered set, not the pre-filter set", () => {
		const view = tableView(audit, {
			active: new Set(["agent", "user"]),
			match,
			sort: null,
			accessors,
			page: 1,
			pageSize: 25,
		});
		expect(view.total).toBe(3);
		expect(view.rows).toHaveLength(3);
	});

	it("without filters or sort the input order passes through", () => {
		const view = tableView(audit, { sort: null, accessors, page: 1, pageSize: 2 });
		expect(view.rows.map(row => row.id)).toEqual(["1", "2"]);
		expect(view.total).toBe(4);
	});
});
