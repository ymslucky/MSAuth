/**
 * Command-palette matching — pure, dependency-free, no DOM (tested in
 * test/frontend/fuzzy.test.ts). The React half of the palette lives in ui.tsx;
 * everything that ranks or filters lives here so it stays trivially testable.
 */

/**
 * Subsequence score for `query` against `text` (case-insensitive): null when
 * some query character is missing or out of order, otherwise an integer where
 * higher is better. Quality signals: exact > prefix > word-boundary start >
 * mid-word, consecutive runs beat gappy ones, shorter haystacks beat longer.
 * An empty/whitespace query matches everything with score 0.
 */
export function fuzzyScore(query: string, text: string): number | null {
	const q = query.trim().toLowerCase();
	if (q === "") return 0;
	const t = text.toLowerCase();
	let score = 0;
	let searchFrom = 0;
	let prevMatch = -2;
	for (const ch of q) {
		const found = t.indexOf(ch, searchFrom);
		if (found === -1) return null;
		if (found === 0 || isBoundary(t[found - 1])) score += 6;
		if (found === prevMatch + 1) score += 5;
		if (prevMatch >= 0 && found > prevMatch + 1) score -= Math.min(4, found - prevMatch - 1);
		prevMatch = found;
		searchFrom = found + 1;
	}
	if (t === q) score += 20;
	else if (t.startsWith(q)) score += 12;
	score += Math.max(0, 6 - Math.floor(t.length / 8));
	return score + 10;
}

const isBoundary = (ch: string | undefined): boolean => ch === undefined || !/[a-z0-9]/.test(ch);

/**
 * Rank `items` by the best fuzzy match across label (direct hits) and
 * optional keywords (fallback hits, ranked below the same score earned on the
 * label). Empty query short-circuits to the original order; equal scores keep
 * the original order (stable).
 */
export function searchRanked<T>(
	items: readonly T[],
	query: string,
	text: (item: T) => string,
	keywords?: (item: T) => string,
): T[] {
	if (query.trim() === "") return [...items];
	const TIEBREAK = 65536; // score dominates; original order decides ties
	const ranked: { item: T; rank: number }[] = [];
	items.forEach((item, index) => {
		const direct = fuzzyScore(query, text(item));
		const kw = keywords ? fuzzyScore(query, keywords(item)) : null;
		const best = direct !== null || kw !== null
			? Math.max(direct ?? Number.NEGATIVE_INFINITY, kw === null ? Number.NEGATIVE_INFINITY : kw - 4)
			: null;
		if (best !== null) ranked.push({ item, rank: best * TIEBREAK + (items.length - index) });
	});
	ranked.sort((a, b) => b.rank - a.rank);
	return ranked.map(entry => entry.item);
}
