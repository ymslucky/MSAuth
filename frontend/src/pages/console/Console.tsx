import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
	AppWindow, BellRing, Bot, Copy, Earth, GitBranch, KeyRound, Languages, LayoutDashboard,
	LogOut, MonitorSmartphone, Moon, ScrollText, Search, Share2, SlidersHorizontal, Sun,
	SunMoon, UserRound, Users, Globe,
} from "lucide-react";
import { api } from "../../api";
import { LangSegmented, useLang, useT } from "../../i18n";
import { ThemeToggle, themeChoices, useTheme, type ThemeChoice } from "../../theme";
import { Link, navigate, usePath } from "../../router";
import { Card, Skeleton, SkeletonStats, SkeletonTable } from "../../ui";
import { operatorOnlyPathGuard, visibleSections } from "../../consoleNav";
import { GITHUB_REPO_URL, palettePlatformKey, PaletteEntry, PaletteProvider, usePalette } from "../../palette-ui";
import { useNotice } from "../../notice-ui";
import type { OverviewResponse } from "./Overview";

/* Route-level code splitting: the entry bundle carries only the shell; each
   console page is its own lazy chunk. The same import() expressions feed the
   PRELOADS map below, so hovering a sidebar link warms the exact chunk the
   click will need (pointerenter only — no modulepreload links). */
const Overview = lazy(() => import("./Overview"));
const Applications = lazy(() => import("./Applications").then(m => ({ default: m.Applications })));
const Keys = lazy(() => import("./Keys").then(m => ({ default: m.Keys })));
const Resources = lazy(() => import("./Resources").then(m => ({ default: m.Resources })));
const AgentsPage = lazy(() => import("./Agents").then(m => ({ default: m.Agents })));
const Delegations = lazy(() => import("./Delegations").then(m => ({ default: m.Delegations })));
const Audit = lazy(() => import("./Audit").then(m => ({ default: m.Audit })));
const Sessions = lazy(() => import("./Sessions").then(m => ({ default: m.Sessions })));
const Alerts = lazy(() => import("./Alerts").then(m => ({ default: m.Alerts })));
const UsersPage = lazy(() => import("./Users").then(m => ({ default: m.Users })));
const Settings = lazy(() => import("./Settings").then(m => ({ default: m.Settings })));
const Domains = lazy(() => import("./Domains").then(m => ({ default: m.Domains })));
const UserDetail = lazy(() => import("./UserDetail").then(m => ({ default: m.UserDetail })));
const Account = lazy(() => import("./Account").then(m => ({ default: m.Account })));
// Documentation-as-code catalog — direct URL only, linked nowhere public.
const Catalog = lazy(() => import("./Catalog"));

/** Path → dynamic chunk loader, shared with the sidebar's hover preloading. */
const PRELOADS: Record<string, () => Promise<unknown>> = {
	"/": () => import("./Overview"),
	"/account": () => import("./Account"),
	"/applications": () => import("./Applications"),
	"/keys": () => import("./Keys"),
	"/resources": () => import("./Resources"),
	"/agents": () => import("./Agents"),
	"/delegations": () => import("./Delegations"),
	"/audit": () => import("./Audit"),
	"/sessions": () => import("./Sessions"),
	"/alerts": () => import("./Alerts"),
	"/users": () => import("./Users"),
	"/settings": () => import("./Settings"),
	"/domains": () => import("./Domains"),
};

/** Warm a route chunk on pointer intent; failures stay silent (click retries). */
function preloadRoute(to: string): (() => void) | undefined {
	const load = PRELOADS[to];
	if (!load) return undefined;
	return () => { void load().catch(() => undefined); };
}

/** Suspense fallback while a route chunk streams in. */
function PageFallback() {
	return (
		<>
			<SkeletonStats />
			<Card><SkeletonTable /></Card>
		</>
	);
}

const NAV = [
	{ group: "", items: [{ label: "Overview", to: "/", icon: LayoutDashboard }, { label: "Account", to: "/account", icon: UserRound }] },
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

export interface ConsoleContext {
	user: { id: string; name: string; email: string; image: string | null };
	operator: boolean;
}

const THEME_ICONS: Record<ThemeChoice, typeof Sun> = { auto: SunMoon, light: Sun, dark: Moon };
const THEME_LABELS: Record<ThemeChoice, string> = { auto: "Auto", light: "Light", dark: "Dark" };

/** Static palette entries: navigation, account + preference actions. */
function useConsolePaletteEntries(userId: string, operator: boolean): PaletteEntry[] {
	const t = useT();
	const notice = useNotice();
	const { setChoice } = useTheme();
	const { lang, setLang } = useLang();
	return useMemo<PaletteEntry[]>(() => [
		...visibleSections(NAV, operator).flatMap(section => section.items.map(item => ({
			id: `nav:${item.to}`,
			group: "navigate" as const,
			label: t(item.label),
			keywords: item.to,
			icon: <item.icon size={15} strokeWidth={1.75} aria-hidden />,
			perform: () => navigate(item.to),
		}))),
		{
			id: "action:copy-user-id",
			group: "action",
			label: t("Copy user ID"),
			keywords: "user id copy",
			icon: <Copy size={15} strokeWidth={1.75} aria-hidden />,
			perform: () => {
				navigator.clipboard.writeText(userId)
					.then(() => notice.toast("info", t("Copied")))
					.catch(() => undefined);
			},
		},
		{
			id: "action:github",
			group: "action",
			label: t("Open GitHub repository"),
			keywords: "github source repo code",
			icon: <GitBranch size={15} strokeWidth={1.75} aria-hidden />,
			perform: () => window.open(GITHUB_REPO_URL, "_blank", "noopener"),
		},
		...themeChoices.map(choice => {
			const Icon = THEME_ICONS[choice];
			return {
				id: `action:theme-${choice}`,
				group: "action" as const,
				label: `${t("Theme")}: ${t(THEME_LABELS[choice])}`,
				keywords: `theme ${choice}`,
				icon: <Icon size={15} strokeWidth={1.75} aria-hidden />,
				perform: () => setChoice(choice),
			};
		}),
		{
			id: "action:lang",
			group: "action",
			label: t("Switch language"),
			keywords: `language ${lang === "zh" ? "english en" : "chinese zhongwen"}`,
			icon: <Languages size={15} strokeWidth={1.75} aria-hidden />,
			perform: () => setLang(lang === "zh" ? "en" : "zh"),
		},
	], [t, notice, userId, operator, setChoice, lang, setLang]);
}

export default function Console() {
	const t = useT();
	const path = usePath();
	const [context, setContext] = useState<ConsoleContext | null>(null);
	const [gone, setGone] = useState(false);
	const notice = useNotice();
	// Unconditional: the hook count must not differ between the loading and
	// loaded renders (userId is just an empty placeholder until it arrives).
	const paletteEntries = useConsolePaletteEntries(context?.user.id ?? "", context?.operator ?? false);

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
	if (operatorOnlyPathGuard(path, context.operator)) {
		return <div className="auth-shell"><p className="muted">{t("Platform administrator access required.")}</p></div>;
	}

	return (
		<PaletteProvider entries={paletteEntries}>
			<ConsoleShell path={path} context={context} />
		</PaletteProvider>
	);
}

function ConsoleShell(props: { path: string; context: ConsoleContext }) {
	const t = useT();
	const notice = useNotice();
	const { setOpen } = usePalette();
	const path = props.path;
	const context = props.context;
	const page = renderPage(path, context, t);

	return (
		<div className="shell">
			<aside className="side">
				<div className="brand"><img src="/favicon.svg" alt="" />MSAuth</div>
				<button type="button" className="palette-chip" onClick={() => setOpen(true)} aria-label={t("Command palette")}>
					<Search size={13} strokeWidth={1.75} aria-hidden />
					{t("Search")}
					<kbd aria-hidden="true">{palettePlatformKey()}</kbd>
				</button>
				<nav>
					{visibleSections(NAV, context.operator).map(section => (
						<div key={section.group}>
							{section.group !== "" && <div className="group">{t(section.group)}</div>}
							{section.items.map(item => {
								// Prefix match keeps /users/:id highlighting the Users entry.
								const active = path === item.to || path.startsWith(`${item.to}/`);
								return (
									<Link
										key={item.to}
										to={item.to}
										className={active ? "active" : ""}
										ariaCurrent={active}
										onPointerEnter={preloadRoute(item.to)}
									>
										<item.icon size={16} strokeWidth={1.75} aria-hidden />
										{t(item.label)}
									</Link>
								);
							})}
						</div>
					))}
				</nav>
				<div className="who">
					<div className="who-id">
						{context.user.email}
						{context.operator && <> · <strong>{t("operator")}</strong></>}
					</div>
					<div className="who-row">
						<a href="/api/auth/sign-out" onClick={event => {
							event.preventDefault();
							api("/api/auth/sign-out", { method: "POST" })
								.then(() => { window.location.href = "/login"; })
								.catch(() => notice.toast("error", t("Sign out failed — please retry")));
						}}><LogOut size={13} strokeWidth={1.75} aria-hidden />{t("Sign out")}</a>
						<span className="controls-row"><LangSegmented /><ThemeToggle /></span>
					</div>
				</div>
				</aside>
				<main className="main">
					<div className="page-stage" key={path}>
						<Suspense fallback={<PageFallback />}>{page}</Suspense>
					</div>
				</main>
		</div>
	);
}

function renderPage(path: string, context: ConsoleContext, t: (key: string) => string) {
	if (path.startsWith("/users/")) {
		return <UserDetail id={decodeURIComponent(path.slice("/users/".length))} />;
	}
	switch (path) {
		case "/": return <Overview />;
		case "/account": return <Account user={context.user} />;
		case "/applications": return <Applications />;
		case "/keys": return <Keys />;
		case "/resources": return <Resources operator={context.operator} />;
		case "/agents": return <AgentsPage />;
		case "/delegations": return <Delegations />;
		case "/audit": return <Audit operator={context.operator} />;
		case "/sessions": return <Sessions />;
		case "/alerts": return <Alerts />;
		case "/users": return <UsersPage />;
		case "/settings": return <Settings />;
		case "/domains": return <Domains />;
		case "/dev": return <Catalog />;
		default:
			return <p className="muted">{t("Unknown page.")}</p>;
	}
}
