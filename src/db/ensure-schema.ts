import { SCHEMA_SQL } from "./schema";
import { SEED_SQL } from "./seed";
import { toStatements } from "./sql";

/** Bump when schema.ts/seed.ts change so cold starts re-reconcile. */
export const SCHEMA_VERSION = 1;
const VERSION_KEY = "config:schema-version";

const REQUIRED_COLUMNS: {
	table: string;
	column: string;
	ddl: string;
}[] = [
	{
		table: "role",
		column: "is_system",
		ddl: "ALTER TABLE role ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0",
	},
];

/**
 * Applies the desired schema: structure, then column repairs for databases
 * created before a column existed, then seed data. Fully idempotent.
 */
export async function runEnsureSchema(db: D1Database): Promise<void> {
	await db.batch(
		toStatements(SCHEMA_SQL).map((statement) => db.prepare(statement)),
	);

	for (const required of REQUIRED_COLUMNS) {
		const columns = await db
			.prepare(`PRAGMA table_info(${required.table})`)
			.all<{ name: string }>();
		if (!columns.results.some((c) => c.name === required.column)) {
			await db.prepare(required.ddl).run();
		}
	}

	await db.batch(
		toStatements(SEED_SQL).map((statement) => db.prepare(statement)),
	);
}

/**
 * Cold-start entry: skips the reconcile entirely when a previous run of the
 * same schema version already succeeded (flag survives across isolates in
 * KV; deploying a new SCHEMA_VERSION re-runs it everywhere).
 */
export async function ensureSchema(db: D1Database, storage: KVNamespace): Promise<void> {
	const expected = String(SCHEMA_VERSION);
	if ((await storage.get(VERSION_KEY)) === expected) return;
	await runEnsureSchema(db);
	await storage.put(VERSION_KEY, expected);
}