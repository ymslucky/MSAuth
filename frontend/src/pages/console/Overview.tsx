import { useEffect, useState } from "react";
import { api, fmtDate } from "../../api";
import { useT } from "../../i18n";
import { Card, Empty, Stat } from "../../ui";

export interface OverviewResponse {
	counts: { applications: number; agents: number; delegations: number; keys: number };
	activity: { id: string; action: string; resourceType: string; resourceId: string; createdAt: number }[];
	usage: { day: string; count: number }[];
	user: { name: string; email: string; image: string | null };
	operator: boolean;
}

export default function Overview() {
	const t = useT();
	const [data, setData] = useState<OverviewResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api<OverviewResponse>("/api/v1/overview").then(setData).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	}, []);

	if (error) return <p className="error-note">{error}</p>;
	if (!data) return <p className="muted">{t("Loading…")}</p>;
	const peak = Math.max(1, ...data.usage.map(row => row.count));

	return (
		<>
			<div className="main-head">
				<div>
					<h1>{t("Welcome, {name}", { name: data.user.name })}</h1>
					<p>{t("Your identity platform at a glance.")}</p>
				</div>
			</div>
			<div className="stat-grid">
				<Stat label={t("Applications")} value={data.counts.applications} />
				<Stat label={t("Active agents")} value={data.counts.agents} />
				<Stat label={t("Live delegations")} value={data.counts.delegations} />
				<Stat label={t("API keys")} value={data.counts.keys} />
			</div>
			<Card title={t("Token exchanges (7 days)")}>
				{data.usage.length === 0 ? (
					<Empty>{t("No delegated token exchanges yet.")}</Empty>
				) : (
					<div className="stat-grid">
						{data.usage.map(row => (
							<div className="stat" key={row.day}>
								<strong>{row.count}</strong>
								<span>{row.day}</span>
								<div className="bar" style={{ width: `${(row.count / peak) * 100}%` }} />
							</div>
						))}
					</div>
				)}
			</Card>
			<Card title={t("Recent activity")}>
				{data.activity.length === 0 ? (
					<Empty>{t("Nothing recorded yet.")}</Empty>
				) : (
					<div className="table-wrap">
						<table>
							<thead>
								<tr><th>{t("Action")}</th><th>{t("Resource")}</th><th>{t("When")}</th></tr>
							</thead>
							<tbody>
								{data.activity.map(row => (
									<tr key={row.id}>
										<td><code>{row.action}</code></td>
										<td>{row.resourceType} <span className="mono muted">{row.resourceId.slice(0, 8)}</span></td>
										<td className="muted">{fmtDate(row.createdAt)}</td>
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
