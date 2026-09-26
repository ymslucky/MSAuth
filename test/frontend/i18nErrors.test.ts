import { describe, expect, it } from "vitest";
import { tMessage } from "../../frontend/src/i18n";
import { zh } from "../../frontend/src/dict";

/**
 * Server error strings reach users raw through toasts and error states.
 * tMessage looks them up in the zh dict (falling back to the raw string, and
 * passing through untouched in EN mode) — these tests pin the messages users
 * actually hit: Better Auth base/2FA/passkey codes, platform guards and the
 * browser's own network failure.
 */
describe("tMessage — server error localization", () => {
	it("translates the auth errors users actually hit", () => {
		const expected: Record<string, string> = {
			"Invalid email or password": "邮箱或密码不正确",
			"Invalid password": "密码不正确",
			"Password too short": "密码太短",
			"Password too long": "密码太长",
			"User already exists.": "用户已存在。",
			"Session expired. Re-authenticate to perform this action.": "会话已过期，请重新登录后再执行此操作。",
		};
		for (const [english, chinese] of Object.entries(expected)) {
			expect(zh[english]).toBe(chinese);
			expect(tMessage(english, "zh")).toBe(chinese);
		}
	});

	it("translates two-factor and passkey errors", () => {
		const expected: Record<string, string> = {
			"Invalid code": "验证码不正确",
			"Invalid backup code": "备份代码不正确",
			"TOTP is already enabled": "TOTP 已启用",
			"Two factor isn't enabled": "双因素认证尚未启用",
			"Too many attempts. Please request a new code.": "尝试次数过多，请重新获取验证码。",
			"Too many failed verification attempts. Your account is temporarily locked. Please try again later.":
				"验证失败次数过多，账户已临时锁定，请稍后再试。",
			"Challenge not found": "挑战已失效，请重试",
			"Authentication failed": "认证失败",
			"Previously registered": "此验证器此前已注册过",
		};
		for (const [english, chinese] of Object.entries(expected)) {
			expect(zh[english]).toBe(chinese);
			expect(tMessage(english, "zh")).toBe(chinese);
		}
	});

	it("translates platform guard errors and network failures", () => {
		const expected: Record<string, string> = {
			"rate_limited": "请求过于频繁，请稍后再试。",
			"payload_too_large": "请求体过大。",
			"registration_disabled": "注册已关闭。",
			"unauthorized": "未登录或会话已过期。",
			"invalid_origin": "请求来源不受信任。",
			"not_found": "资源不存在。",
			"internal_error": "服务内部错误。",
			"Failed to fetch": "网络请求失败，请检查网络连接。",
		};
		for (const [english, chinese] of Object.entries(expected)) {
			expect(zh[english]).toBe(chinese);
			expect(tMessage(english, "zh")).toBe(chinese);
		}
	});

	it("passes unknown and English-mode strings through untouched", () => {
		expect(tMessage("Some novel server message", "zh")).toBe("Some novel server message");
		expect(tMessage("Invalid email or password", "en")).toBe("Invalid email or password");
		expect(tMessage("邮箱或密码不正确", "zh")).toBe("邮箱或密码不正确");
	});
});
