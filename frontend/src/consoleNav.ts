/**
 * Console navigation visibility — pure logic, tested in
 * test/frontend/consoleNav.test.ts. The operator-only set mirrors the
 * requireOperator-guarded routes in src/iam/governance.ts: /users and
 * /settings. Alerts and domains are user-scoped and stay visible to all.
 */

export const OPERATOR_ONLY_PATHS = ["/users", "/settings"] as const;

/** True for paths that only platform administrators may open. */
export function isOperatorOnly(to: string): boolean {
	return OPERATOR_ONLY_PATHS.some(prefix => to === prefix || to.startsWith(`${prefix}/`));
}

export interface NavSectionLike<T> {
	group: string;
	items: T[];
}

/** Drop operator-only entries for plain users; prune groups left empty.
 *  Operators keep the full navigation untouched. */
export function visibleSections<T extends { to: string }>(sections: NavSectionLike<T>[], operator: boolean): NavSectionLike<T>[] {
	if (operator) return sections;
	return sections
		.map(section => ({ ...section, items: section.items.filter(item => !isOperatorOnly(item.to)) }))
		.filter(section => section.items.length > 0);
}

/** Route guard: plain users landing on an operator-only path get bounced. */
export function operatorOnlyPathGuard(path: string, operator: boolean): boolean {
	return !operator && isOperatorOnly(path);
}
