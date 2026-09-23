import { useEffect, useState } from "react";
import { api, fmtDate } from "../../api";
import { Card, Empty, Stat } from "../../ui";

export interface OverviewResponse {
	counts: { applications: number; agents: number; delegations: number; keys: number };
	activity: { id: string; action: string; resourceType: string; resourceId: string; createdAt: number }[];
	usage: { day: string; count: number }[];
	user: { name: string; email: string; image: string | null };
	operator: boolean;
}

export default function Overview() {
	const [data, setData] = useState<OverviewResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api<OverviewResponse>("/api/v1/overview").then(setData).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
	}, []);

	if (error) return <p className="error-note">{error}</p>;
	if (!data) return <p className="muted">Loading…</p>;
	const peak = Math.max(1, ...data.usage.map(row => row.count));

	return (
		<>
			<div className="main-head">
				<div>
					<h1>Welcome, {data.user.name}</h1>
					<p>Your identity platform at a glance.</p>
				</div>
			</div>
			<div className="stat-grid">
				<Stat label="Applications" value={data.counts.applications} />
				<Stat label="Active agents" value={data.counts.agents} />
				<Stat label="Live delegations" value={data.counts.delegations} />
				<Stat label="API keys" value={data.counts.keys} />
			</div>
			<Card title="Token exchanges (7 days)">
				{data.usage.length === 0 ? (
					<Empty>No delegated token exchanges yet.</Empty>
				) : (
					<div className="stat-grid">
						{data.usage.map(row => (
							<div className="stat" key={row.day}>
								<strong>{row.count}</strong>
								<span>{row.day}</span>
								<div style={{ height: 4, background: "var(--accent)", width: `${(row.count / peak) * 100}%`, borderRadius: 2, marginTop: 6 }} />
							</div>
						))}
					</div>
				)}
			</Card>
			<Card title="Recent activity">
				{data.activity.length === 0 ? (
					<Empty>Nothing recorded yet.</Empty>
				) : (
					<div className="table-wrap">
						<table>
							<thead>
								<tr><th>Action</th><th>Resource</th><th>When</th></tr>
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
