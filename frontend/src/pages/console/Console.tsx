import { useEffect, useState } from "react";
import { api } from "../../api";
import { Link, usePath } from "../../router";
import Overview, { type OverviewResponse } from "./Overview";
import { Applications, Keys, Resources } from "./Developer";
import { Agents, Delegations } from "./Agents";
import { Audit, Sessions, Alerts } from "./Security";
import { Users, Settings, Domains } from "./Admin";

const NAV = [
	{ group: "", items: [["Overview", "/"]] },
	{ group: "Developer", items: [["Applications", "/applications"], ["API keys", "/keys"], ["Resources", "/resources"]] },
	{ group: "Agents", items: [["Agents", "/agents"], ["Delegations", "/delegations"]] },
	{ group: "Security", items: [["Audit log", "/audit"], ["Sessions", "/sessions"], ["Alerts", "/alerts"]] },
	{ group: "Platform", items: [["Users", "/users"], ["Settings", "/settings"], ["Domains", "/domains"]] },
] as const;

const OPERATOR_ONLY = ["/users", "/settings"];

export interface ConsoleContext {
	user: { name: string; email: string; image: string | null };
	operator: boolean;
}

export default function Console() {
	const path = usePath();
	const [context, setContext] = useState<ConsoleContext | null>(null);
	const [gone, setGone] = useState(false);

	useEffect(() => {
		api<OverviewResponse>("/api/v1/overview")
			.then(result => setContext({ user: result.user, operator: result.operator }))
			.catch(() => setGone(true));
	}, []);

	if (gone) {
		window.location.href = "/login";
		return <div className="auth-shell"><p className="muted">Redirecting to sign-in…</p></div>;
	}
	if (!context) return <div className="auth-shell"><p className="muted">Loading…</p></div>;
	if (context.operator === false && OPERATOR_ONLY.some(prefix => path === prefix)) {
		return <div className="auth-shell"><p className="muted">Platform administrator access required.</p></div>;
	}

	const page = renderPage(path, context);

	return (
		<div className="shell">
			<aside className="side">
				<div className="brand">MSAuth</div>
				<nav>
					{NAV.map(section => (
						<div key={section.group}>
							{section.group !== "" && <div className="group">{section.group}</div>}
							{section.items.map(([label, to]) => (
								<Link key={to} to={to} className={path === to ? "active" : ""}>{label}</Link>
							))}
						</div>
					))}
				</nav>
				<div className="who">
					{context.user.email}
					{context.operator && <> · <strong>operator</strong></>}
					<br />
					<a href="/api/auth/sign-out" onClick={event => {
						event.preventDefault();
						void api("/api/auth/sign-out", { method: "POST" }).finally(() => { window.location.href = "/login"; });
					}}>Sign out</a>
				</div>
			</aside>
			<main className="main">{page}</main>
		</div>
	);
}

function renderPage(path: string, context: ConsoleContext) {
	switch (path) {
		case "/": return <Overview />;
		case "/applications": return <Applications />;
		case "/keys": return <Keys />;
		case "/resources": return <Resources operator={context.operator} />;
		case "/agents": return <Agents />;
		case "/delegations": return <Delegations />;
		case "/audit": return <Audit operator={context.operator} />;
		case "/sessions": return <Sessions />;
		case "/alerts": return <Alerts />;
		case "/users": return <Users />;
		case "/settings": return <Settings />;
		case "/domains": return <Domains />;
		default:
			return <p className="empty">Unknown page.</p>;
	}
}
