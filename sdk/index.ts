/**
 * MSAuth Agent SDK — runtime-independent (fetch + WebCrypto + jose only).
 *
 * Wraps the platform's Agent authorization stack into a few calls:
 * PKCE + DPoP authorization, request-bound proofs, audience-scoped fetch,
 * refresh rotation and RFC 8693 token exchange against an MSAuth delegation.
 */

import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair } from "jose";

export interface AgentOptions {
  issuer: string;
  clientId: string;
  /** Exact HTTPS resource identifier this agent may call. */
  resource: string;
}

export interface AuthorizationFlow {
  url: string;
  state: string;
  verifier: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export interface AuthorizationDetail {
  type: "mcp_tool";
  locations: string[];
  actions: string[];
  identifiers: string[];
}

export interface ExchangeOptions {
  scope?: string[];
  authorizationDetails?: AuthorizationDetail[];
}

const EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replace(/=+$/, "");
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomValue(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function httpsUrl(value: string, label: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must be an HTTPS URL`);
  return url.href;
}

export class AgentClient {
  private discovered: { token_endpoint?: string } | undefined;
  private tokens: (TokenSet & { expiresAt?: number }) | undefined;

  private constructor(
    readonly issuer: string,
    readonly clientId: string,
    readonly resource: string,
    private readonly keyPair: CryptoKeyPair,
    readonly jkt: string,
  ) {}

  /** Generates the agent's DPoP key pair and binds it to issuer, client and resource. */
  static async create(options: AgentOptions): Promise<AgentClient> {
    const issuer = httpsUrl(options.issuer, "issuer");
    const resource = httpsUrl(options.resource, "resource");
    const keyPair = await generateKeyPair("ES256", { extractable: true });
    const jwk = await exportJWK(keyPair.publicKey);
    return new AgentClient(new URL(issuer).origin, options.clientId, new URL(resource).href, keyPair, await calculateJwkThumbprint(jwk));
  }

  /** Builds the PKCE authorization redirect with an exact resource and the DPoP thumbprint. */
  async authorize(redirectUri: string, scopes: string[]): Promise<AuthorizationFlow> {
    if (!scopes.length) throw new Error("At least one scope is required");
    const verifier = randomValue();
    const state = randomValue();
    const url = new URL("/api/auth/oauth2/authorize", this.issuer);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(" "),
      state,
      code_challenge: base64url(await sha256(verifier)),
      code_challenge_method: "S256",
      resource: this.resource,
      dpop_jkt: this.jkt,
    }).toString();
    return { url: url.href, state, verifier, redirectUri, scopes: [...scopes] };
  }

  /** Validates the callback state and swaps the code for DPoP-bound tokens. */
  async complete(callbackUrl: string, flow: AuthorizationFlow): Promise<TokenSet> {
    const url = new URL(callbackUrl);
    if (url.searchParams.get("state") !== flow.state) throw new Error("Authorization state mismatch");
    const error = url.searchParams.get("error");
    if (error) throw new Error(`Authorization failed: ${error}${url.searchParams.get("error_description") ? ": " + url.searchParams.get("error_description") : ""}`);
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Missing authorization code");
    const endpoint = await this.tokenEndpoint();
    return this.request(endpoint, new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      code,
      code_verifier: flow.verifier,
      redirect_uri: flow.redirectUri,
      resource: this.resource,
    }));
  }

  /** Signs a request-bound DPoP proof; the private key never leaves this instance. */
  async proof(method: string, targetUrl: string, accessToken?: string): Promise<string> {
    const url = new URL(targetUrl);
    const payload: Record<string, unknown> = {
      htm: method.toUpperCase(),
      htu: url.origin + url.pathname,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
    };
    if (accessToken) payload.ath = base64url(await sha256(accessToken));
    return new SignJWT(payload)
      .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: await exportJWK(this.keyPair.publicKey) })
      .sign(this.keyPair.privateKey);
  }

  /**
   * Fetches the bound resource with a DPoP-bound access token.
   * Refuses to send the token anywhere outside the configured resource.
   */
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? new Request(input, init) : new Request(input, init);
    const target = new URL(request.url);
    if (target.protocol !== "https:" || target.href !== this.resource && !target.href.startsWith(this.resource.endsWith("/") ? this.resource : this.resource + "/")) {
      throw new Error(`Refusing to send the ${this.resource} token to ${target.href}`);
    }
    const token = await this.currentAccessToken();
    const headers = new Headers(request.headers);
    headers.set("authorization", `DPoP ${token}`);
    headers.set("dpop", await this.proof(request.method, target.href, token));
    return fetch(new Request(request, { headers }));
  }

  /** Rotates the access token using the refresh token (the server rotates it on every use). */
  async refresh(): Promise<TokenSet> {
    if (!this.tokens?.refresh_token) throw new Error("No refresh token available");
    const endpoint = await this.tokenEndpoint();
    return this.request(endpoint, new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: this.tokens.refresh_token,
      resource: this.resource,
    }));
  }

  /**
   * RFC 8693 token exchange: swaps a user-approved subject token for a
   * short-lived, DPoP-bound token scoped to one MSAuth delegation.
   */
  async exchange(delegationId: string, subjectToken: string, options?: ExchangeOptions): Promise<TokenSet> {
    const endpoint = await this.tokenEndpoint();
    const fields: Record<string, string> = {
      grant_type: EXCHANGE_GRANT,
      client_id: this.clientId,
      subject_token: subjectToken,
      subject_token_type: ACCESS_TOKEN_TYPE,
      delegation_id: delegationId,
      resource: this.resource,
    };
    if (options?.scope?.length) fields.scope = options.scope.join(" ");
    if (options?.authorizationDetails?.length) fields.authorization_details = JSON.stringify(options.authorizationDetails);
    return this.request(endpoint, new URLSearchParams(fields));
  }

  private async tokenEndpoint(): Promise<string> {
    if (!this.discovered) {
      try {
        const response = await fetch(new URL("/.well-known/oauth-authorization-server", this.issuer));
        this.discovered = response.ok ? await response.json() as { token_endpoint?: string } : {};
      } catch {
        this.discovered = {};
      }
    }
    return this.discovered.token_endpoint ?? new URL("/api/auth/oauth2/token", this.issuer).href;
  }

  private async currentAccessToken(): Promise<string> {
    if (!this.tokens) throw new Error("No access token — complete an authorization flow first");
    if (this.tokens.expiresAt !== undefined && this.tokens.expiresAt < Date.now() + 30000 && this.tokens.refresh_token) {
      await this.refresh();
    }
    return this.tokens.access_token;
  }

  private async request(endpoint: string, body: URLSearchParams): Promise<TokenSet> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", dpop: await this.proof("POST", endpoint) },
      body,
    });
    const result = await response.json().catch(() => undefined) as TokenSet | undefined;
    if (!response.ok || !result?.access_token) {
      throw new Error(`Token request failed (${response.status}): ${JSON.stringify(result)}`);
    }
    this.tokens = { ...result, expiresAt: result.expires_in ? Date.now() + result.expires_in * 1000 : undefined };
    return this.tokens;
  }
}

/** MCP protected-resource metadata pointing at the platform authorization server. */
export function createProtectedResourceMetadata(resource: string, authorizationServer: string) {
  return {
    resource: httpsUrl(resource, "resource"),
    authorization_servers: [new URL(httpsUrl(authorizationServer, "authorization server")).origin],
  };
}

/** Resource-server gate for one MCP tool call: audience, expiry and RAR authority. */
export function authorizeToolCall(
  claims: { aud?: unknown; exp?: unknown; authorization_details?: unknown },
  resource: string,
  identifier: string,
  action: string,
): void {
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(resource)) throw new Error("Token audience does not include this resource");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) throw new Error("Token is expired");
  const details = claims.authorization_details as AuthorizationDetail[] | undefined;
  const granted = details?.some(detail =>
    detail.type === "mcp_tool" &&
    detail.locations.includes(resource) &&
    detail.actions.includes(action) &&
    detail.identifiers.includes(identifier),
  );
  if (!granted) throw new Error(`No grant for ${action} on ${identifier} at ${resource}`);
}
