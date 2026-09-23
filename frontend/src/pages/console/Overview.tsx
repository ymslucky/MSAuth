import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtDate, fullTimestamp } from "../../api";
import { useT } from "../../i18n";
import { ledgerPalette, useTheme } from "../../theme";
import { mountLedgerArt } from "../../art";
import { Link } from "../../router";
import { GITHUB_REPO_URL } from "../../ui";
import { daySeries, isFirstRun, onboardingSteps, sparklineGeometry, toneMix, type OnboardingStepId } from "../../viz";
import { Card, EmptyState, ErrorState, ActionTag, MonoId, ResourceTag, resourceTone, Skeleton, SkeletonStats, SkeletonTable, Stat } from "../../ui";

export interface OverviewResponse {
	counts: { applications: number; agents: number; delegations: number; keys: number };
	activity: { id: string; action: string; resourceType: string; resourceId: string; createdAt: number }[];
	usage: { day: string; count: number }[];
	user: { id: string; name: string; email: string; image: string | null };
	operator: boolean;
}

/* Tone → legend label. Reuses existing nav vocabulary; the colored dot does
   the real work — this is the same visual language as ResourceTag. */
const TONE_LABELS: Record<string, string> = {
	agent: "Agents",
	delegation: "Delegations",
	apikey: "API keys",
	user: "Users",
	session: "Sessions",
	domain: "Domains",
	alert: "Alerts",
	resource: "Resources",
	client: "Applications",
	other: "Other",
};

/** Inline-SVG sparkline over the endpoint's daily token-exchange series. */
function SparklineCard(props: { series: { day: string; count: number }[] }) {
	const t = useT();
	const counts = props.series.map(row => row.count);
	const total = counts.reduce((sum, value) => sum + value, 0);
	const peak = Math.max(...counts);
	const geo = sparklineGeometry(counts, 320, 64, 4);
	const last = geo.points[geo.points.length - 1];
	return (
		<Card title={t("Token exchange trend (7 days)")}>
			<div className="viz-spark">
				<div className="viz-headline">
					<strong className="serif viz-num">{total}</strong>
					<span className="viz-caption">{t("exchanges in 7 days")}</span>
				</div>
				<svg
					viewBox="0 0 320 64"
					className="spark"
					role="img"
					aria-label={`${total} ${t("exchanges in 7 days")}`}
				>
					<path d={geo.area} className="spark-area" />
					<path d={geo.line} className="spark-line" />
					{last && <circle cx={last.x} cy={last.y} r="3" className="spark-dot" />}
				</svg>
				<div className="spark-axis mono" aria-hidden="true">
					<span>{props.series[0]?.day.slice(5)}</span>
					<span>{t("peak")}{peak}</span>
					<span>{props.series[props.series.length - 1]?.day.slice(5)}</span>
				</div>
			</div>
		</Card>
	);
}

/** Recent audit rows as stacked tone dots + a ResourceTag-tone legend. */
function ToneMixCard(props: { activity: OverviewResponse["activity"] }) {
	const t = useT();
	const mix = useMemo(() => toneMix(props.activity, resourceTone), [props.activity]);
	return (
		<Card title={t("Activity mix")}>
			{mix.length === 0 ? (
				<EmptyState art="audit" title={t("Nothing recorded yet.")} />
			) : (
				<div className="viz-mix">
					<div className="viz-dots" role="img" aria-label={t("Recent events by resource type")}>
						{props.activity.map(row => (
							<span
								key={row.id}
								className={`dot dot--${resourceTone(row.resourceType)}`}
								title={row.action}
							/>
						))}
					</div>
					<ul className="viz-legend">
						{mix.map(entry => (
							<li key={entry.tone}>
								<span className={`dot dot--${entry.tone}`} aria-hidden="true" />
								<span>{t(TONE_LABELS[entry.tone] ?? entry.tone)}</span>
								<strong className="mono">{entry.count}</strong>
							</li>
						))}
					</ul>
				</div>
			)}
		</Card>
	);
}

const STEP_TARGETS: Record<OnboardingStepId, { to?: string; href?: string }> = {
	application: { to: "/applications" },
	agent: { to: "/agents" },
	exchange: { href: GITHUB_REPO_URL },
};

const STEP_TITLES: Record<OnboardingStepId, string> = {
	application: "Create an application",
	agent: "Register an agent",
	exchange: "Exchange your first token",
};

/** First-run guidance: 创建应用 → 注册代理 → 交换第一个令牌, each an anchor. */
function FirstRunCard(props: { applications: number; agents: number; exchanges: number }) {
	const t = useT();
	const { steps } = onboardingSteps(props);
	return (
		<Card title={t("Get started in three steps.")}>
			<ol className="steps">
				{steps.map((step, index) => {
					const target = STEP_TARGETS[step.id];
					return (
						<li key={step.id} className={step.done ? "done" : step.current ? "current" : ""}>
							<span className="step-num serif" aria-hidden="true">{index + 1}</span>
							{target.to
								? <Link to={target.to}>{t(STEP_TITLES[step.id])}</Link>
								: <a href={target.href} target="_blank" rel="noreferrer">{t(STEP_TITLES[step.id])}</a>}
							{step.done && <span className="step-check" aria-label={t("Done")}>✓</span>}
						</li>
					);
				})}
			</ol>
		</Card>
	);
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
	// 7 numbers — cheaper than memoizing past the early returns above.
	const series = daySeries(data.usage, Date.now(), 7);
	const exchanges = series.reduce((sum, row) => sum + row.count, 0);
	const firstRun = isFirstRun({ ...data.counts, exchanges });

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
			{firstRun
				? <FirstRunCard applications={data.counts.applications} agents={data.counts.agents} exchanges={exchanges} />
				: (
					<div className="viz-grid">
						<SparklineCard series={series} />
						<ToneMixCard activity={data.activity} />
					</div>
				)}
			<Card title={t("Recent activity")}>
				{data.activity.length === 0 ? (
					<EmptyState art="audit" title={t("Nothing recorded yet.")} />
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
