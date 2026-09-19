import { SCHEMA_SQL } from "./schema";
import { SEED_SQL } from "./seed";
import { toStatements } from "./sql";

/**
 * Columns that older databases may be missing (table -> column -> repair
 * DDL). Declared explicitly because ALTER statements cannot be expressed
 * idempotently in the schema snapshot.
 */
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
	await db.batch(toStatements(SCHEMA_SQL).map((statement) => db.prepare(statement)));

	for (const required of REQUIRED_COLUMNS) {
		const columns = await db
			.prepare(`PRAGMA table_info(${required.table})`)
			.all<{ name: string }>();
		if (!columns.results.some((c) => c.name === required.column)) {
			await db.prepare(required.ddl).run();
		}
	}

	await db.batch(toStatements(SEED_SQL).map((statement) => db.prepare(statement)));
}

// One-shot per isolate: the schema check runs on the first request of a
// cold start, not on every request.
let applied: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
	applied ??= runEnsureSchema(db).catch((e) => {
		applied = null;
		throw e;
	});
	return applied;
}