/**
 * Hand-drawn-style line-art for empty states — one distinct illustration per
 * first-run moment, drawn in the ledger's ink: 1.5px `currentColor` strokes
 * on a 48×48 grid, one reserved vermilion accent detail each (var(--accent)),
 * rounded caps for the "written by hand" feel. Pure presentational components;
 * sized and coloured by the surrounding `.empty-state` CSS.
 */
import type { ReactElement } from "react";

const stroke = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

const accent = { stroke: "var(--accent)", strokeWidth: 1.5, strokeLinecap: "round" } as const;

/** Browser window with a dashed callback round-trip. */
function ArtApplications() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<rect x="6" y="9" width="36" height="30" rx="3" />
				<path d="M6 16h36" />
				<path d="M10 12.5h.01M14 12.5h.01" strokeWidth={2} />
				<path d="M12 24h9M12 30h14" strokeDasharray="3 3.5" />
				<path d="M30 22c6 0 8 3 8 7 0 3-2 5-5 5h-3" strokeDasharray="2.5 3" />
				<path d="M32.5 31.5 30 34l2.5 2.5" />
			</g>
			<path {...accent} d="M36 26.5l1.6 3.2 3.4.4-2.5 2.3.7 3.3-3.2-1.7" />
		</svg>
	);
}

/** Keyring with two keys, one bow picked out in vermilion. */
function ArtKeys() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<circle cx="19" cy="18" r="7.5" />
				<path d="M24.5 23.5 37 36" />
				<path d="M32 31.5l3-3M35 34.5l3-3" />
				<circle cx="35" cy="15" r="4.5" />
				<path d="M31.5 18 22 27.5" />
			</g>
			<circle cx="19" cy="18" r="2.6" fill="none" stroke="var(--accent)" strokeWidth={1.5} />
		</svg>
	);
}

/** Agent head with antenna — a small listening machine. */
function ArtAgents() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<rect x="13" y="17" width="22" height="17" rx="5" />
				<circle cx="20.5" cy="25" r="1.6" strokeWidth={2} />
				<circle cx="27.5" cy="25" r="1.6" strokeWidth={2} />
				<path d="M24 17v-5" />
				<path d="M17 34v4M31 34v4" />
				<path d="M13 23h-3M35 23h3" strokeDasharray="2 3" />
			</g>
			<circle cx="24" cy="9.5" r="2.2" fill="none" stroke="var(--accent)" strokeWidth={1.5} />
		</svg>
	);
}

/** Delegation graph: one root granting two narrowed branches. */
function ArtDelegations() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<circle cx="11" cy="24" r="4.5" />
				<circle cx="37" cy="13" r="3.5" />
				<circle cx="37" cy="35" r="3.5" />
				<path d="M15.5 22.5c6-4 9-5.5 15-8" strokeDasharray="3 3" />
				<path d="M15.5 25.5c6 4 9 5.5 15 8" strokeDasharray="3 3" />
			</g>
			<path {...accent} d="M27.5 13.5 30.5 14.5l-1 3" />
			<path {...accent} d="M27.5 34.5l3-1-1-3" opacity={0.65} />
		</svg>
	);
}

/** Ruled ledger lines with a vermilion audit tick. */
function ArtAudit() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<path d="M8 14h32M8 22h32M8 30h20M8 38h26" opacity={0.75} />
				<path d="M8 10v32" opacity={0.4} />
			</g>
			<path {...accent} d="M31 30.5l2.8 2.8 5.2-6" strokeWidth={2} />
		</svg>
	);
}

/** Two identities — the operator and the people they govern. */
function ArtUsers() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<circle cx="19" cy="16" r="6" />
				<path d="M8 38c0-6 5-10 11-10s11 4 11 10" />
				<circle cx="34.5" cy="19.5" r="4.5" />
				<path d="M33 27.5c4.5 0 8 3.5 8 8.5" />
			</g>
			<circle cx="34.5" cy="12.5" r="1.8" fill="var(--accent)" stroke="none" />
		</svg>
	);
}

/** Magnifier over an empty dotted field. */
function ArtSearch() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<g {...stroke}>
				<circle cx="21" cy="20" r="9.5" />
				<path d="M28 27.5 38 37.5" strokeWidth={2} />
				<path d="M8 10h.01M40 12h.01M10 38h.01M31 8h.01" strokeWidth={2} opacity={0.55} />
			</g>
			<path {...accent} d="M21 15.5a4.5 4.5 0 0 1 4.5 4.5" />
		</svg>
	);
}

export type EmptyArt =
	| "applications" | "keys" | "agents" | "delegations"
	| "audit" | "users" | "search";

/** Finite illustration vocabulary (drives the /dev catalog). */
export const EMPTY_ARTS: readonly EmptyArt[] = [
	"applications", "keys", "agents", "delegations", "audit", "users", "search",
];

const ART: Record<EmptyArt, () => ReactElement> = {
	applications: ArtApplications,
	keys: ArtKeys,
	agents: ArtAgents,
	delegations: ArtDelegations,
	audit: ArtAudit,
	users: ArtUsers,
	search: ArtSearch,
};

export function EmptyIllustration(props: { art: EmptyArt }) {
	const Draw = ART[props.art];
	return (
		<span className="empty-art" aria-hidden="true">
			<Draw />
		</span>
	);
}
