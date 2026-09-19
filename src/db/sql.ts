/** Splits a raw SQL script into individual statements. */
export function toStatements(sql: string): string[] {
	// Strip comment lines first (they may contain semicolons), then split on
	// statement-terminating semicolons.
	const withoutComments = sql
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n");
	return withoutComments
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}