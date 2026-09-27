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

/** Map policy-validation failures to 400 while keeping the underlying reason visible. */
export function invalidInput(name: string, error: unknown): HTTPException {
  if (error instanceof HTTPException) return error;
  return new HTTPException(400, { message: `Invalid ${name}: ${(error as Error)?.message ?? "check the value"}` });
}

export function isUniqueViolation(error: unknown): boolean {
  return String((error as Error)?.message ?? "").includes("UNIQUE constraint failed");
}

export function auditStatement(c: Context<AppEnv>, action: string, type: string, id: string, detail: unknown = {}) {
  return c.env.AUTH_DB.prepare("INSERT INTO auditEvent (id, actorId, action, resourceType, resourceId, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), c.get("identity").user.id, action, type, id, JSON.stringify(detail), Date.now());
}

export async function audit(c: Context<AppEnv>, action: string, type: string, id: string, detail: unknown = {}) {
  try {
    await auditStatement(c, action, type, id, detail).run();
  } catch (error) {
    // The mutation already happened — make the lost audit row observable.
    console.error(JSON.stringify({ requestId: c.get("requestId"), kind: "audit_write_failed", action, resourceType: type, resourceId: id }));
    throw error;
  }
}

export function page(c: Context<AppEnv>) {
  // Deep offsets are pure scan cost on D1 — the console never paginates past
  // a few hundred rows, so the clamp is generous for APIs and hostile to abuse.
  const raw = Number(c.req.query("page") ?? 1);
  const number = Number.isSafeInteger(raw) && raw > 0 ? Math.min(raw, 1000) : 1;
  return { number, limit: 30, offset: (number - 1) * 30 };
}
