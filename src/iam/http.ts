import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { AppEnv } from "./types";

export function requireOperator(c: Context<AppEnv>) {
  if (!c.get("operator")) throw new HTTPException(403, { message: "Platform administrator access required" });
}

export async function body(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await c.req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new HTTPException(400, { message: "Expected a JSON object" }); }
}

export function text(value: unknown, name: string, max = 100): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HTTPException(400, { message: `Invalid ${name}` });
  }
  return value.trim();
}

export function list(value: unknown, name: string, max = 32): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(v => typeof v !== "string" || !v || v.length > 2048)) {
    throw new HTTPException(400, { message: `Invalid ${name}` });
  }
  return [...new Set(value)] as string[];
}

export function auditStatement(c: Context<AppEnv>, action: string, type: string, id: string, detail: unknown = {}) {
  return c.env.AUTH_DB.prepare("INSERT INTO auditEvent (id, actorId, action, resourceType, resourceId, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), c.get("identity").user.id, action, type, id, JSON.stringify(detail), Date.now());
}

export async function audit(c: Context<AppEnv>, action: string, type: string, id: string, detail: unknown = {}) {
  await auditStatement(c, action, type, id, detail).run();
}

export function page(c: Context<AppEnv>) {
  const raw = Number(c.req.query("page") ?? 1);
  const number = Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 100000) : 1;
  return { number, limit: 30, offset: (number - 1) * 30 };
}
