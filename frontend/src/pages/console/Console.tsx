import { useEffect, useState } from "react";
import {
	AppWindow, BellRing, Bot, Earth, KeyRound, LayoutDashboard, MonitorSmartphone,
	ScrollText, Share2, SlidersHorizontal, Users, Globe,
} from "lucide-react";
import { api } from "../../api";
import { useT } from "../../i18n";
import { Link, usePath } from "../../router";
import { Skeleton, useNotice } from "../../ui";
import Overview, { type OverviewResponse } from "./Overview";
import { Applications, Keys, Resources } from "./Developer";
import { Agents, Delegations } from "./Agents";
import { Audit, Sessions, Alerts } from "./Security";
import { Users as UsersPage, Settings, Domains, UserDetail } from "./Admin";

const NAV = [
	{ group: "", items: [{ label: "Overview", to: "/", icon: LayoutDashboard }] },
	{
		group: "Developer",
		items: [
			{ label: "Applications", to: "/applications", icon: AppWindow },
			{ label: "API keys", to: "/keys", icon: KeyRound },
			{ label: "Resources", to: "/resources", icon: Globe },
		],
	},
	{
		group: "Agents",
		items: [
			{ label: "Agents", to: "/agents", icon: Bot },
			{ label: "Delegations", to: "/delegations", icon: Share2 },
		],
	},
	{
		group: "Security",
		items: [
			{ label: "Audit log", to: "/audit", icon: ScrollText },
			{ label: "Sessions", to: "/sessions", icon: MonitorSmartphone },
			{ label: "Alerts", to: "/alerts", icon: BellRing },
		],
	},
	{
		group: "Platform",
		items: [
			{ label: "Users", to: "/users", icon: Users },
			{ label: "Settings", to: "/settings", icon: SlidersHorizontal },
			{ label: "Domains", to: "/domains", icon: Earth },
		],
	},
];

const OPERATOR_ONLY = ["/users", "/settings"];

export interface ConsoleContext {
	user: { name: string; email: string; image: string | null };
	operator: boolean;
}

export default function Console() {
	const t = useT();
	const path = usePath();
	const [context, setContext] = useState<ConsoleContext | null>(null);
	const [gone, setGone] = useState(false);
	const notice = useNotice();

	useEffect(() => {
		api<OverviewResponse>("/api/v1/overview")
			.then(result => setContext({ user: result.user, operator: result.operator }))
			.catch(() => setGone(true));
	}, []);

	if (gone) {
		window.location.href = "/login";
		return <div className="auth-shell"><p className="muted">{t("Redirecting to sign-in…")}</p></div>;
	}
	if (!context) {
		return (
			<div className="auth-shell">
				<div style={{ width: "min(320px, 100%)" }} role="status" aria-label={t("Loading…")}>
					<Skeleton style={{ width: 120, height: 18, marginBottom: 22 }} />
					<Skeleton style={{ width: "70%", marginBottom: 10 }} />
					<Skeleton style={{ width: "88%", marginBottom: 10 }} />
					<Skeleton style={{ width: "56%", marginBottom: 10 }} />
					<Skeleton style={{ width: "78%" }} />
				</div>
			</div>
		);
	}
	if (context.operator === false && OPERATOR_ONLY.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
		return <div className="auth-shell"><p className="muted">{t("Platform administrator access required.")}</p></div>;
	}

	const page = renderPage(path, context, t);

	return (
		<div className="shell">
			<aside className="side">
				<div className="brand"><img src="/favicon.svg" alt="" />MSAuth</div>
				<nav>
					{NAV.map(section => (
						<div key={section.group}>
							{section.group !== "" && <div className="group">{t(section.group)}</div>}
							{section.items.map(item => (
								<Link key={item.to} to={item.to} className={path === item.to ? "active" : ""} ariaCurrent={path === item.to}>
									<item.icon size={16} strokeWidth={1.75} aria-hidden />
									{t(item.label)}
								</Link>
							))}
						</div>
					))}
				</nav>
				<div className="who">
					{context.user.email}
					{context.operator && <> · <strong>{t("operator")}</strong></>}
					<br />
					<a href="/api/auth/sign-out" onClick={event => {
					event.preventDefault();
					api("/api/auth/sign-out", { method: "POST" })
						.then(() => { window.location.href = "/login"; })
						.catch(() => notice.toast("error", t("Sign out failed — please retry")));
				}}>{t("Sign out")}</a>
				</div>
			</aside>
			<main className="main">{page}</main>
		</div>
	);
}

function renderPage(path: string, context: ConsoleContext, t: (key: string) => string) {
	if (path.startsWith("/users/")) {
		return <UserDetail id={decodeURIComponent(path.slice("/users/".length))} />;
	}
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
		case "/users": return <UsersPage />;
		case "/settings": return <Settings />;
		case "/domains": return <Domains />;
		default:
			return <p className="empty">{t("Unknown page.")}</p>;
	}
}
