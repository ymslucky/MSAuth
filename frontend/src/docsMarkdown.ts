/**
 * Markdown serialization for the public docs — powers the "Markdown" view
 * mode (raw, copyable source). Pure data-in/string-out; prose runs through
 * the translate function so the export follows the active language.
 */
import type { DocsConstraint, DocsSection } from "./docsData";

export type Translate = (key: string) => string;

export function toMarkdown(sections: DocsSection[], constraints: DocsConstraint[], t: Translate): string {
	const out: string[] = [`# ${t("Integration guide")}`, ""];
	for (const section of sections) {
		out.push(`## ${t(section.title)}`, "", t(section.audience), "");
		section.steps.forEach((step, index) => out.push(`${index + 1}. ${t(step)}`));
		out.push("");
		if (section.code) {
			out.push(`### ${t(section.code.label)}`, "", "```" + (section.code.lang ?? "ts"), section.code.content, "```", "");
		}
	}
	out.push(`## ${t("Platform invariants")}`, "");
	for (const constraint of constraints) {
		out.push(`- **${t(constraint.rule)}**: ${t(constraint.detail)}`);
	}
	return out.join("\n").trimEnd() + "\n";
}
