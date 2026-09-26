/**
 * Minimal WebAuthn ceremony client for the @better-auth/passkey endpoints.
 * Mirrors @simplewebauthn's JSON wire format: every ArrayBuffer becomes a
 * base64url string. The pure encoders are unit-tested; the browser ceremony
 * functions below them are thin and typed against lib.dom.
 */
import { api, post } from "./api";

export function bytesToB64url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export function isPasskeySupported(): boolean {
	return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

interface CeremonyResponse {
	response: Record<string, ArrayBuffer | null | undefined | string[]>;
	clientExtensionResults?: Record<string, unknown>;
	authenticatorAttachment?: string | null;
}

function serialize(id: string, rawId: ArrayBuffer, type: string, input: CeremonyResponse): Record<string, unknown> {
	const response: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input.response)) {
		if (value instanceof ArrayBuffer) response[key] = bytesToB64url(value);
		else if (value !== null && value !== undefined) response[key] = value;
	}
	return {
		id,
		rawId: bytesToB64url(rawId),
		type,
		authenticatorAttachment: input.authenticatorAttachment ?? undefined,
		clientExtensionResults: input.clientExtensionResults ?? {},
		response,
	};
}

/** Browser PublicKeyCredential shaped for serialization (ArrayBuffers preserved). */
interface SerializableCredential extends CeremonyResponse {
	id: string;
	rawId: ArrayBuffer;
	type: string;
}

export function serializeRegistration(credential: SerializableCredential): Record<string, unknown> {
	return serialize(credential.id, credential.rawId, credential.type, credential);
}

export function serializeAuthentication(credential: SerializableCredential): Record<string, unknown> {
	return serialize(credential.id, credential.rawId, credential.type, credential);
}

interface AuthenticationOptions {
	challenge: string;
	rp?: { id?: string; name?: string };
	timeout?: number;
	userVerification?: string;
	allowCredentials?: { id: string; transports?: string[] }[];
	extensions?: Record<string, unknown>;
}

interface RegistrationOptions extends AuthenticationOptions {
	user: { id: string; name: string; displayName: string };
	pubKeyCredParams: { type: string; alg: number }[];
	excludeCredentials?: { id: string; transports?: string[] }[];
	authenticatorSelection?: Record<string, unknown>;
	attestation?: string;
}

/** Sign in with a platform/passkey authenticator; the server sets the session cookie. */
export async function authenticateWithPasskey(): Promise<void> {
	if (!isPasskeySupported()) throw new Error("Passkeys are not supported in this browser");
	const options = await api<AuthenticationOptions>("/api/auth/passkey/generate-authenticate-options");
	const credential = await navigator.credentials.get({
		publicKey: {
			challenge: b64urlToBytes(options.challenge),
			rpId: options.rp?.id,
			timeout: options.timeout,
			userVerification: (options.userVerification as UserVerificationRequirement) ?? "preferred",
			...(options.allowCredentials ? {
				allowCredentials: options.allowCredentials.map(descriptor => ({
					id: b64urlToBytes(descriptor.id),
					type: "public-key" as const,
					...(descriptor.transports ? { transports: descriptor.transports as AuthenticatorTransport[] } : {}),
				})),
			} : {}),
			...(options.extensions ? { extensions: options.extensions } : {}),
		},
	}) as unknown as SerializableCredential | null;
	if (!credential) throw new Error("No passkey was provided");
	await post("/api/auth/passkey/verify-authentication", { response: serializeAuthentication(credential) });
}

/** Register a new passkey on the current session. */
export async function registerPasskey(name?: string): Promise<void> {
	if (!isPasskeySupported()) throw new Error("Passkeys are not supported in this browser");
	const query = name ? `?name=${encodeURIComponent(name)}` : "";
	const options = await api<RegistrationOptions>(`/api/auth/passkey/generate-register-options${query}`);
	const credential = await navigator.credentials.create({
		publicKey: {
			challenge: b64urlToBytes(options.challenge),
			rp: options.rp as PublicKeyCredentialRpEntity,
			user: {
				id: b64urlToBytes(options.user.id),
				name: options.user.name,
				displayName: options.user.displayName,
			},
			pubKeyCredParams: options.pubKeyCredParams.map(param => ({ type: "public-key" as const, alg: param.alg })),
			timeout: options.timeout,
			...(options.excludeCredentials ? {
				excludeCredentials: options.excludeCredentials.map(descriptor => ({
					id: b64urlToBytes(descriptor.id),
					type: "public-key" as const,
					...(descriptor.transports ? { transports: descriptor.transports as AuthenticatorTransport[] } : {}),
				})),
			} : {}),
			...(options.authenticatorSelection ? { authenticatorSelection: options.authenticatorSelection as AuthenticatorSelectionCriteria } : {}),
			attestation: (options.attestation as AttestationConveyancePreference) ?? "none",
		},
	}) as unknown as SerializableCredential | null;
	if (!credential) throw new Error("No passkey was created");
	await post("/api/auth/passkey/verify-registration", {
		response: serializeRegistration(credential),
		...(name ? { name } : {}),
	});
}
