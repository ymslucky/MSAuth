import { describe, expect, it } from "vitest";
import { MAX_VISIBLE_TOASTS, capVisibleToasts, noticeTtl, noticeTones } from "../../frontend/src/notice";

describe("noticeTtl", () => {
	it("auto-dismisses success toasts after 3s", () => {
		expect(noticeTtl("success")).toBe(3000);
	});

	it("keeps error toasts longer (6s) so they can be read", () => {
		expect(noticeTtl("error")).toBe(6000);
	});

	it("gives info toasts an intermediate lifetime", () => {
		expect(noticeTtl("info")).toBe(4000);
	});
});

describe("noticeTones", () => {
	it("exposes exactly the success/error/info variants", () => {
		expect(noticeTones).toEqual(["success", "error", "info"]);
	});
});

describe("capVisibleToasts", () => {
	it("keeps at most the newest three toasts visible", () => {
		const capped = capVisibleToasts([
			{ id: 1, tone: "success", text: "a" },
			{ id: 2, tone: "error", text: "b" },
			{ id: 3, tone: "info", text: "c" },
			{ id: 4, tone: "success", text: "d" },
		]);
		expect(capped.map(item => item.id)).toEqual([2, 3, 4]);
	});

	it("leaves stacks smaller than the cap untouched", () => {
		const stack = [{ id: 1, tone: "success", text: "a" }];
		expect(capVisibleToasts(stack)).toEqual(stack);
	});

	it("uses MAX_VISIBLE_TOASTS = 3", () => {
		expect(MAX_VISIBLE_TOASTS).toBe(3);
	});
});
