/**
 * Ensures the D1 database exists (recreates it after a full teardown) and
 * syncs its id into wrangler.json. Runs automatically before deploy via the
 * `predeploy` npm script.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");

const DATABASE_NAME = "openauth-db";
const CONFIG_FILE = "wrangler.json";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function sh(command) {
	return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function listDatabases() {
	try {
		const out = sh("npx wrangler d1 list --json");
		const parsed = JSON.parse(out || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function createDatabase() {
	console.log(`[prepare-db] creating D1 database "${DATABASE_NAME}"...`);
	// The human-readable output embeds the new database id as a UUID.
	const out = sh(`npx wrangler d1 create ${DATABASE_NAME}`);
	const match = out.match(UUID_RE);
	if (!match) throw new Error("could not parse new database id from wrangler output");
	return match[0];
}

function syncConfigId(databaseId) {
	const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
	const binding = config.d1_databases.find((d) => d.binding === "AUTH_DB");
	if (!binding) throw new Error("AUTH_DB binding missing from wrangler.json");
	if (binding.database_id === databaseId) return;
	binding.database_id = databaseId;
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, "\t") + "\n");
	console.log(`[prepare-db] wrangler.json database_id updated to ${databaseId}`);
}

const existing = listDatabases().find((d) => d.name === DATABASE_NAME);
const databaseId = existing ? existing.uuid : createDatabase();
syncConfigId(databaseId);
console.log(`[prepare-db] D1 ready (${databaseId})`);