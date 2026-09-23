import { APIError } from "better-auth/api";
import { createDpopReplayStore, getDpopJktFromPayload, verifyDpopProof } from "better-auth/oauth2";
import { getOAuthProviderApi, type OAuthProviderExtension } from "@better-auth/oauth-provider";
import type { Bindings } from "../iam/types";
import { narrowAuthorization, subset } from "./policy";

export const EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
export const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

export interface Delegation {
  id: string;
  ownerId: string;
  agentId: string;
  parentId: string | null;
  resource: string;
  scopes: string;
  authorizationDetails: string;
  expiresAt: number;
  revokedAt: number | null;
  depth: number;
}

export async function activeDelegation(db: D1Database, id: string): Promise<Delegation | null> {
  let current = await db.prepare("SELECT * FROM delegation WHERE id = ?").bind(id).first<Delegation>();
  const leaf = current;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id) || visited.size >= 5 || current.revokedAt || current.expiresAt <= Date.now()) return null;
    visited.add(current.id);
    const agent = await db.prepare('SELECT a.id FROM agent a JOIN "user" u ON u.id = a.ownerId WHERE a.id = ? AND a.status = ? AND (u.banned IS NULL OR u.banned = 0)')
      .bind(current.agentId, "active").first();
    if (!agent) return null;
    if (!current.parentId) return leaf;
    current = await db.prepare("SELECT * FROM delegation WHERE id = ?").bind(current.parentId).first<Delegation>();
  }
  return null;
}

function reject(error: string, message: string): never {
  throw new APIError("BAD_REQUEST", { error, error_description: message });
}

/** RFC 8693 restricted delegation profile. Better Auth owns validation/signing and token storage. */
export function exchangeExtension(env: Bindings): OAuthProviderExtension {
  return {
    metadata: () => ({ authorization_details_types_supported: ["mcp_tool"] }),
    grants: {
      [EXCHANGE_GRANT]: async ({ ctx, provider, opts }) => {
        const body = ctx.body as Record<string, unknown>;
        if (body.subject_token_type !== ACCESS_TOKEN_TYPE || typeof body.subject_token !== "string" ||
          (body.requested_token_type && body.requested_token_type !== ACCESS_TOKEN_TYPE) ||
          body.actor_token || body.actor_token_type) reject("invalid_request", "Only explicit access-token delegation is supported");
        if (typeof body.delegation_id !== "string" || typeof body.resource !== "string") reject("invalid_request", "A delegation and exact resource are required");
        const grant = await activeDelegation(env.AUTH_DB, body.delegation_id);
        if (!grant || grant.resource !== body.resource || grant.expiresAt < Date.now() + 10000) reject("invalid_grant", "Delegation is unavailable");
        const requested = typeof body.scope === "string" ? body.scope.split(" ").filter(Boolean) : JSON.parse(grant.scopes) as string[];
        if (!requested.length || !subset(requested, JSON.parse(grant.scopes)) || requested.includes("offline_access")) reject("invalid_scope", "Exchange cannot expand scopes or issue refresh tokens");
        const caller = await provider.authenticateClient({ scopes: requested, requireCredentials: false });
        const agent = await env.AUTH_DB.prepare("SELECT clientId, dpopJkt FROM agent WHERE id = ?").bind(grant.agentId)
          .first<{ clientId: string; dpopJkt: string }>();
        if (!agent?.dpopJkt || agent.clientId !== caller.clientId) reject("invalid_client", "Client is not bound to this agent");
        const subject = await provider.requireActiveAccessToken(body.subject_token);
        if (subject.sub !== grant.ownerId || subject.iss !== new URL(env.BETTER_AUTH_URL).origin ||
          subject.client_id !== caller.clientId || subject.aud !== grant.resource ||
          typeof subject.exp !== "number" || subject.exp * 1000 < Date.now() + 10000) {
          reject("invalid_grant", "Subject token must belong to this user, client and resource with sufficient lifetime");
        }
        if (!subset(requested, String(subject.scope ?? "").split(" "))) reject("invalid_scope", "Subject token does not grant requested scopes");
        const subjectDelegation = subject.delegation_id;
        if ((grant.parentId && subjectDelegation !== grant.parentId) || (!grant.parentId && subjectDelegation)) reject("invalid_grant", "Invalid delegation chain");
        const expectedJkt = getDpopJktFromPayload(subject);
        if (!expectedJkt || expectedJkt !== agent.dpopJkt) reject("invalid_grant", "Subject token must be bound to the registered agent key");
        let details: unknown;
        try {
          details = body.authorization_details ? JSON.parse(String(body.authorization_details)) : JSON.parse(grant.authorizationDetails);
          details = narrowAuthorization(JSON.parse(grant.authorizationDetails), details);
          if (subjectDelegation) details = narrowAuthorization(subject.authorization_details, details);
        } catch { reject("invalid_authorization_details", "Requested authority exceeds consent"); }
        const proof = await verifyDpopProof({
          proofJwt: ctx.headers?.get("dpop") ?? "", method: "POST",
          url: new URL(env.BETTER_AUTH_URL).origin + "/api/auth/oauth2/token",
          expectedJkt, signingAlgorithms: ["ES256"], proofMaxAgeSeconds: 60,
          replayStore: createDpopReplayStore(ctx.context.internalAdapter),
        }).catch(() => reject("invalid_dpop_proof", "Invalid or replayed DPoP proof"));
        const resource = await env.AUTH_DB.prepare("SELECT accessTokenTtl, disabled FROM oauthResource WHERE identifier = ?")
          .bind(grant.resource).first<{ accessTokenTtl: number | null; disabled: number }>();
        if (!resource || resource.disabled || (resource.accessTokenTtl ?? 300) > 300) reject("invalid_target", "Resource must use a lifetime of at most five minutes");
        const user = await ctx.context.internalAdapter.findUserById(grant.ownerId);
        if (!user) reject("invalid_grant", "User no longer exists");
        const lifetime = Math.min(300, subject.exp - Math.floor(Date.now() / 1000), Math.floor((grant.expiresAt - Date.now()) / 1000));
        const issuer = getOAuthProviderApi(ctx, { ...opts, accessTokenExpiresIn: lifetime }, EXCHANGE_GRANT);
        const result = await issuer.issueTokens({
          client: caller.client, user, scopes: requested, resources: [grant.resource],
          sessionId: typeof subject.sid === "string" ? subject.sid : undefined,
          confirmation: { jkt: proof.jkt },
          accessTokenClaims: {
            delegation_id: grant.id, authorization_details: details,
            act: { sub: grant.agentId, ...(subject.act ? { act: subject.act } : {}) },
          },
          tokenResponse: { issued_token_type: ACCESS_TOKEN_TYPE, authorization_details: details },
        });
        await env.AUTH_DB.prepare("INSERT INTO auditEvent (id, actorId, action, resourceType, resourceId, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), grant.ownerId, "token.exchanged", "delegation", grant.id, JSON.stringify({ agentId: grant.agentId, resource: grant.resource, scopes: requested }), Date.now()).run();
        return result;
      },
    },
  };
}
