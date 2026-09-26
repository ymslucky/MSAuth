import { afterEach, describe, expect, it, vi } from "vitest";
import {
	b64urlToBytes,
	bytesToB64url,
	isPasskeySupported,
	serializeAuthentication,
	serializeRegistration,
} from "../../frontend/src/webauthn";

const encoder = new TextEncoder();

function bytes(text: string): ArrayBuffer {
	return encoder.encode(text).buffer as ArrayBuffer;
}

describe("base64url — WebAuthn wire encoding", () => {
	it("round-trips arbitrary bytes without padding or alphabet escaping", () => {
		const input = bytes("challenge-bytes?!~");
		const encoded = bytesToB64url(input);
		expect(encoded).not.toMatch(/[+/=]/);
		const decoded = b64urlToBytes(encoded);
		expect(new TextDecoder().decode(decoded)).toBe("challenge-bytes?!~");
	});

	it("decodes unpadded input with missing padding", () => {
		// "ab" in standard base64 is "YWI="; base64url drops the padding.
		expect(new TextDecoder().decode(b64urlToBytes("YWI"))).toBe("ab");
	});
});

describe("serializeRegistration — browser credential → server JSON", () => {
	it("maps buffers to base64url and keeps transports for the server", () => {
		const json = serializeRegistration({
			id: "cred-1",
			rawId: bytes("raw"),
			type: "public-key",
			authenticatorAttachment: "platform",
			clientExtensionResults: { credProtect: 2 },
			response: {
				clientDataJSON: bytes("client-data"),
				attestationObject: bytes("attestation"),
				transports: ["internal", "hybrid"],
			},
		});
		expect(JSON.parse(JSON.stringify(json))).toEqual({
			id: "cred-1",
			rawId: bytesToB64url(bytes("raw")),
			type: "public-key",
			authenticatorAttachment: "platform",
			clientExtensionResults: { credProtect: 2 },
			response: {
				clientDataJSON: bytesToB64url(bytes("client-data")),
				attestationObject: bytesToB64url(bytes("attestation")),
				transports: ["internal", "hybrid"],
			},
		});
	});
});

describe("serializeAuthentication — browser credential → server JSON", () => {
	it("omits a null userHandle and serializes the assertion fields", () => {
		const json = serializeAuthentication({
			id: "cred-1",
			rawId: bytes("raw"),
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: bytes("client-data"),
				authenticatorData: bytes("auth-data"),
				signature: bytes("signature"),
				userHandle: null,
			},
		});
		expect(JSON.parse(JSON.stringify(json))).toEqual({
			id: "cred-1",
			rawId: bytesToB64url(bytes("raw")),
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: bytesToB64url(bytes("client-data")),
				authenticatorData: bytesToB64url(bytes("auth-data")),
				signature: bytesToB64url(bytes("signature")),
			},
		});
	});

	it("keeps a present userHandle", () => {
		const json = serializeAuthentication({
			id: "cred-1",
			rawId: bytes("raw"),
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: bytes("a"),
				authenticatorData: bytes("b"),
				signature: bytes("c"),
				userHandle: bytes("user"),
			},
		});
		expect((json.response as Record<string, unknown>).userHandle).toBe(bytesToB64url(bytes("user")));
	});
});

describe("isPasskeySupported — gate before touching the WebAuthn API", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("is false where window/WebAuthn are unavailable (server or old browser)", () => {
		expect(isPasskeySupported()).toBe(false);
	});

	it("is true when PublicKeyCredential exists on window", () => {
		vi.stubGlobal("window", { PublicKeyCredential: class {} });
		expect(isPasskeySupported()).toBe(true);
	});
});
