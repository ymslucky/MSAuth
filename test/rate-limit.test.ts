import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";
import { ORIGIN } from "./helpers";

it("rate limits GitHub authorize hits per IP", async () => {
	let sawLimited = false;
	for (let i = 0; i < 80; i++) {
		const res = await SELF.fetch(ORIGIN + "/github/authorize", {
			method: "GET",
			redirect: "manual",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cf-connecting-ip": "192.0.2.66",
			},
			
		});
		if (res.status === 429) {
			sawLimited = true;
			break;
		}
	}
	expect(sawLimited).toBe(true);
});