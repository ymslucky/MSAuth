import { describe, expect, it, vi } from "vitest";
import { createOptimisticList } from "../../frontend/src/optimistic";

function harness(initial: string[]) {
	let list = initial;
	const optimistic = createOptimisticList<string>(
		() => list,
		next => { list = next; },
	);
	return {
		optimistic,
		get list() { return list; },
	};
}

describe("createOptimisticList — success path", () => {
	it("applies the mutation immediately, then keeps it after the API resolves", async () => {
		const env = harness(["a", "b"]);
		const api = vi.fn().mockResolvedValue(undefined);
		const result = await env.optimistic.run(
			list => list.filter(id => id !== "a"),
			api,
		);
		expect(api).toHaveBeenCalledTimes(1);
		expect(env.list).toEqual(["b"]);
		expect(result).toEqual(["b"]);
	});

	it("rejects before any API call when the mutate fn throws", async () => {
		const env = harness(["a", "b"]);
		const api = vi.fn();
		await expect(env.optimistic.run(() => { throw new Error("bad mutate"); }, api)).rejects.toThrow("bad mutate");
		expect(api).not.toHaveBeenCalled();
		expect(env.list).toEqual(["a", "b"]);
	});
});

describe("createOptimisticList — rollback on failure", () => {
	it("restores the pre-mutation snapshot when the API rejects", async () => {
		const env = harness(["a", "b", "c"]);
		await expect(env.optimistic.run(
			list => list.filter(id => id !== "a"),
			() => Promise.reject(new Error("409")),
		)).rejects.toThrow("409");
		expect(env.list).toEqual(["a", "b", "c"]);
	});
});

describe("createOptimisticList — concurrent operations", () => {
	it("a later success is not clobbered by an earlier operation's rollback", async () => {
		const env = harness(["a", "b"]);
		let failFirst: ((cause: unknown) => void) | undefined;
		const first = env.optimistic.run(
			list => list.filter(id => id !== "a"),
			() => new Promise((_, reject) => { failFirst = reject; }),
		);
		const second = env.optimistic.run(
			list => list.filter(id => id !== "b"),
			() => Promise.resolve(),
		);
		expect(env.list).toEqual([]);
		failFirst!(new Error("slow op failed"));
		await expect(first).rejects.toThrow("slow op failed");
		await expect(second).resolves.toEqual([]);
		// The slow failed op must NOT roll the fast successful one back.
		expect(env.list).toEqual([]);
	});

	it("a failed later op rolls back to the state it observed at start", async () => {
		const env = harness(["a", "b"]);
		await env.optimistic.run(list => [...list, "c"], () => Promise.resolve());
		expect(env.list).toEqual(["a", "b", "c"]);
		await expect(env.optimistic.run(list => [...list, "d"], () => Promise.reject(new Error("boom"))))
			.rejects.toThrow("boom");
		expect(env.list).toEqual(["a", "b", "c"]);
	});
});
