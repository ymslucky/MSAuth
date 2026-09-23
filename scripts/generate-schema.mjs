import { build } from "esbuild";
import { getSchema } from "better-auth/db";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

await build({
  entryPoints: ["src/iam/auth.ts"], outfile: ".wrangler/schema-config.mjs",
  platform: "node", format: "esm", bundle: true, packages: "external",
});
const { authPlugins } = await import(pathToFileURL(resolve(".wrangler/schema-config.mjs")).href);
const schema = getSchema({
  plugins: authPlugins("https://auth.example.com"),
  rateLimit: { storage: "database" },
});
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const statements = ["-- Generated from Better Auth plugin schemas. Run npm run db:schema after plugin changes.", "PRAGMA foreign_keys = ON;"];
for (const [name, table] of Object.entries(schema)) {
  if (table.disableMigrations) continue;
  const columns = ['"id" TEXT PRIMARY KEY NOT NULL'];
  for (const [column, field] of Object.entries(table.fields)) {
    if (column === "id") continue;
    const type = ["number", "boolean", "date"].includes(field.type) ? "INTEGER" : "TEXT";
    let definition = `${quote(column)} ${type}`;
    if (field.required !== false) definition += " NOT NULL";
    if (field.unique) definition += " UNIQUE";
    if (field.references) definition += ` REFERENCES ${quote(field.references.model)} (${quote(field.references.field)}) ON DELETE ${(field.references.onDelete ?? "cascade").toUpperCase()}`;
    columns.push(definition);
  }
  statements.push(`CREATE TABLE IF NOT EXISTS ${quote(name)} (\n  ${columns.join(",\n  ")}\n);`);
  for (const [column, field] of Object.entries(table.fields)) {
    if (field.index && !field.unique) statements.push(`CREATE INDEX IF NOT EXISTS ${quote(`${name}_${column}_idx`)} ON ${quote(name)} (${quote(column)});`);
  }
  for (const index of table.indexes ?? []) {
    statements.push(`CREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(index.name)} ON ${quote(name)} (${index.columns.map(quote).join(", ")});`);
  }
}
statements.push(`
CREATE TABLE IF NOT EXISTS agent (
  id TEXT PRIMARY KEY NOT NULL,
  ownerId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  clientId TEXT,
  dpopJkt TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_owner_idx ON agent(ownerId);
CREATE UNIQUE INDEX IF NOT EXISTS agent_client_idx ON agent(clientId);
CREATE TABLE IF NOT EXISTS delegation (
  id TEXT PRIMARY KEY NOT NULL,
  ownerId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  agentId TEXT NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  parentId TEXT REFERENCES delegation(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  scopes TEXT NOT NULL,
  authorizationDetails TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  revokedAt INTEGER,
  depth INTEGER NOT NULL CHECK(depth BETWEEN 0 AND 4),
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS delegation_owner_idx ON delegation(ownerId);
CREATE INDEX IF NOT EXISTS delegation_parent_idx ON delegation(parentId);
CREATE TABLE IF NOT EXISTS auditEvent (
  id TEXT PRIMARY KEY NOT NULL,
  actorId TEXT NOT NULL,
  action TEXT NOT NULL,
  resourceType TEXT NOT NULL,
  resourceId TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_actor_time_idx ON auditEvent(actorId, createdAt DESC);
CREATE INDEX IF NOT EXISTS audit_resource_time_idx ON auditEvent(resourceType, resourceId, createdAt DESC);
CREATE TABLE IF NOT EXISTS platformSetting (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verifiedDomain (
  id TEXT PRIMARY KEY NOT NULL,
  ownerId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hostname TEXT UNIQUE NOT NULL,
  challenge TEXT NOT NULL,
  verifiedAt INTEGER,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS securityAlert (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  acknowledgedAt INTEGER,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS security_alert_user_idx ON securityAlert(userId, createdAt DESC);
`);
writeFileSync("migrations/0001_schema.sql", statements.join("\n\n") + "\n");
console.log(`Generated ${Object.keys(schema).length} Better Auth tables and IAM domain tables.`);
