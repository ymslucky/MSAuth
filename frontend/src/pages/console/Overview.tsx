import { useEffect, useRef, useState } from "react";
import { api, fmtDate, fullTimestamp } from "../../api";
import { useT } from "../../i18n";
import { ledgerPalette, useTheme } from "../../theme";
import { mountLedgerArt } from "../../art";
import { Card, Empty, ErrorState, ActionTag, MonoId, ResourceTag, Skeleton, SkeletonStats, SkeletonTable, Stat } from "../../ui";

export interface OverviewResponse {
	counts: { applications: number; agents: number; delegations: number; keys: number };
	activity: { id: string; action: string; resourceType: string; resourceId: string; createdAt: number }[];
	usage: { day: string; count: number }[];
	user: { id: string; name: string; email: string; image: string | null };
	operator: boolean;
}

export default function Overview() {
	const t = useT();
	const { resolved } = useTheme();
	const [data, setData] = useState<OverviewResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [loading, setLoading] = useState(true);
	const heroRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		api<OverviewResponse>("/api/v1/overview")
			.then(result => { setData(result); setLoading(false); })
			.catch(cause => { setError(cause instanceof Error ? cause.message : String(cause)); setLoading(false); });
	}, [attempt]);

	// The Quiet Ledger re-inks on theme flips (brighter strokes, lower alpha in dark).
	useEffect(() => {
		const canvas = heroRef.current;
		if (!canvas) return undefined;
		return mountLedgerArt(canvas, 20260923, ledgerPalette(resolved));
	}, [resolved]);

	const reload = () => setAttempt(value => value + 1);

	if (error && !data) return <ErrorState message={error} onRetry={reload} />;
	if (loading && !data) {
		return (
			<>
				<section className="hero fade-up" aria-hidden="true">
					<canvas ref={heroRef} />
					<div className="hero-copy">
						<p className="hero-eyebrow">{t("Overview")}</p>
						<Skeleton style={{ width: 250, height: 28 }} />
						<Skeleton style={{ width: 190, height: 17, marginTop: 9 }} />
					</div>
				</section>
				<SkeletonStats />
				<Card><SkeletonTable rows={4} /></Card>
			</>
		);
	}
	if (!data) return null;
	const peak = Math.max(1, ...data.usage.map(row => row.count));

	return (
		<>
			<section className="hero fade-up" aria-label={t("Overview")}>
				<canvas ref={heroRef} aria-hidden="true" />
				<div className="hero-copy">
					<p className="hero-eyebrow">{t("Overview")}</p>
					<h1>{t("Welcome, {name}", { name: data.user.name })}</h1>
					<p className="serif">{t("Your identity platform at a glance.")}</p>
				</div>
			</section>
			<div className="stat-grid hero-stats">
				{[
					{ label: t("Applications"), value: data.counts.applications },
					{ label: t("Active agents"), value: data.counts.agents },
					{ label: t("Live delegations"), value: data.counts.delegations },
					{ label: t("API keys"), value: data.counts.keys },
				].map((stat, index) => (
					<div className="fade-up" key={stat.label} style={{ animationDelay: `${index * 35}ms` }}>
						<Stat label={stat.label} value={stat.value} />
					</div>
				))}
			</div>
			<Card title={t("Token exchanges (7 days)")} >
				{data.usage.length === 0 ? (
					<Empty glyph="·">{t("No delegated token exchanges yet.")}</Empty>
				) : (
					<div className="usage">
						{data.usage.map(row => (
							<div className="usage-row" key={row.day}>
								<span className="mono">{row.day}</span>
								<div className="usage-bar"><span style={{ width: `${Math.max(4, (row.count / peak) * 100)}%` }} /></div>
								<strong>{row.count}</strong>
							</div>
						))}
					</div>
				)}
			</Card>
			<Card title={t("Recent activity")}>
				{data.activity.length === 0 ? (
					<Empty glyph="¶">{t("Nothing recorded yet.")}</Empty>
				) : (
					<div className="table-wrap">
						<table>
							<thead>
								<tr><th>{t("Action")}</th><th>{t("Resource")}</th><th className="right">{t("When")}</th></tr>
							</thead>
							<tbody>
								{data.activity.map(row => (
									<tr key={row.id}>
										<td><ActionTag code={row.action} /></td>
										<td><ResourceTag type={row.resourceType} /> <MonoId value={row.resourceId} /></td>
										<td className="right muted"><time title={fullTimestamp(row.createdAt)}>{fmtDate(row.createdAt)}</time></td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
