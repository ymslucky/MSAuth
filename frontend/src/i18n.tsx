import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "msauth-lang";

/**
 * Dictionary convention:
 *  - The English source string is the key; zh maps it to Simplified Chinese.
 *    Missing keys fall back to the English key itself (t() behaviour).
 *  - Technical terms (OAuth, DPoP, token, DCR, API key…) stay untranslated.
 *  - The dict is built from named per-area sections merged into one record —
 *    add new strings to the section they belong to, not to the bottom.
 *  - Audit action codes (e.g. "agent.created") live in the `actions` section,
 *    keyed by their backend code; render them via tAction()/useActionLabel().
 */
const common = {
	// shared primitives & statuses
	"Loading…": "加载中…",
	"Something went wrong.": "出了点问题。",
	"Retry": "重试",
	"Copy": "复制",
	"Copied": "已复制",
	"Confirm": "确认",
	"Cancel": "取消",
	"Save": "保存",
	"Close": "关闭",
	"Done": "完成",
	"Edit": "编辑",
	"Delete": "删除",
	"Back": "返回",
	"yes": "是",
	"no": "否",
	"on": "开",
	"off": "关",
	"active": "正常",
	"revoked": "已撤销",
	"suspended": "已封禁",
	"expired": "已过期",
	"live": "生效中",
	"current": "当前",
	"verified": "已验证",
	"pending": "待验证",
	"disabled": "已禁用",
	"None.": "无。",
	"← Prev": "← 上一页",
	"Next →": "下一页 →",
};

const nav = {
	// shell / sidebar / page chrome
	"Overview": "概览",
	"Developer": "开发者",
	"Applications": "应用",
	"API keys": "API 密钥",
	"Resources": "资源",
	"Agents": "代理",
	"Delegations": "委托",
	"Security": "安全",
	"Audit log": "审计日志",
	"Sessions": "会话",
	"Alerts": "告警",
	"Platform": "平台",
	"Users": "用户",
	"Settings": "设置",
	"Domains": "域名",
	"Redirecting to sign-in…": "正在跳转到登录页…",
	"Platform administrator access required.": "需要平台管理员权限。",
	"operator": "管理员",
	"Sign out": "退出登录",
	"Sign out failed — please retry": "退出登录失败，请重试",
	"Unknown page.": "未知页面。",
	"Dismiss": "知道了",
	"Breadcrumb": "面包屑",
	"Language": "语言",
	"Switch language": "切换语言",
	"Open resource": "打开资源",
	"Navigate": "导航",
	"Actions": "操作",
	"Command palette": "命令面板",
	"Search or jump to…": "搜索或跳转…",
	"Search": "搜索",
	"No matching results.": "没有匹配的结果。",
	"Previous page": "上一页",
	"Next page": "下一页",
	"Filter by status": "按状态筛选",
	"Filter by type": "按类型筛选",
	"Copy user ID": "复制用户 ID",
	"Open GitHub repository": "打开 GitHub 仓库",
	"Admin": "管理",
	"Profile": "资料",
	"Theme": "主题",
	"Auto": "自动",
	"Light": "浅色",
	"Dark": "深色",
	"Other": "其他",
};

const auth = {
	// login + consent
	"Sign in to your identity console.": "登录你的身份控制台。",
	"Email": "邮箱",
	"Password": "密码",
	"Sign in": "登录",
	"or": "或",
	"Continue with GitHub": "使用 GitHub 继续",
	"GitHub sign-in is not configured": "GitHub 登录尚未配置",
	"Authorize application": "授权应用",
	"is requesting access to your identity.": "正在请求访问你的身份。",
	"Resource:": "资源：",
	"Requested scopes": "请求的权限范围",
	"No scopes requested": "未请求任何权限",
	"Allow": "允许",
	"Deny": "拒绝",
	"Consent response did not include a redirect": "授权响应未包含跳转地址",
	"A quiet ledger for identity.": "一本安静的身份账簿。",
	"MSAuth is the identity layer for individuals and one-person companies — OAuth clients, API keys and DPoP-bound agents, governed from one console.": "MSAuth 是面向个人与一人公司的身份层 —— OAuth 客户端、API 密钥与 DPoP 绑定的代理，尽在一个控制台治理。",
	"OAuth 2.1 clients and API keys": "OAuth 2.1 客户端与 API 密钥",
	"DPoP-bound agents with audited delegation chains": "DPoP 绑定的代理与可审计的委托链",
	"Every mutation on the record": "所有变更皆有审计记录",
};

const overview = {
	"Welcome, {name}": "欢迎，{name}",
	"Your identity platform at a glance.": "你的身份平台一览。",
	"Active agents": "活跃代理",
	"Live delegations": "生效中的委托",
	"Token exchanges (7 days)": "近 7 天的 token 交换",
	"No delegated token exchanges yet.": "还没有委托 token 交换记录。",
	"Recent activity": "最近动态",
	"Nothing recorded yet.": "暂无记录。",
	"Action": "操作",
	"Resource": "资源",
	"When": "时间",
	// data viz + first-run guidance
	"Token exchange trend (7 days)": "近 7 天 token 交换趋势",
	"exchanges in 7 days": "7 天内交换",
	"peak": "峰值",
	"Activity mix": "动态构成",
	"Recent events by resource type": "按资源类型分组的最近动态",
	"Get started in three steps.": "三步开始。",
	"Create an application": "创建应用",
	"Exchange your first token": "交换第一个令牌",
};

const applications = {
	"OAuth clients you own. Callback URLs are exact-match; DPoP-bound clients get proof-key tokens.": "你拥有的 OAuth 客户端。回调 URL（Redirect URI）精确匹配；启用 DPoP 的客户端会获得证明密钥绑定的 token。",
	"New application": "新建应用",
	"No applications yet.": "还没有应用。",
	"Name": "名称",
	"Callbacks": "回调 URL",
	"Status": "状态",
	"Rotate": "轮换密钥",
	"Rotate this client secret?": "确定轮换该客户端密钥？",
	"Delete this application and all its tokens?": "确定删除该应用及其所有 token？",
	"New client secret": "新的 Client Secret",
	"Edit application": "编辑应用",
	"Callback URLs": "回调 URL",
	"One per line. Exact HTTPS URLs, or http loopback for native apps.": "每行一个。必须是精确的 HTTPS URL，原生应用可用 http 回环地址。",
	"Confidential client (client secret)": "机密客户端（使用 client secret）",
	"Require DPoP-bound tokens": "要求 DPoP 绑定的 token",
	"Copy it now — this value is never shown again.": "请立即复制 — 该值不会再显示。",
	"Applications are OAuth clients that sign in users or call APIs on your behalf.": "应用是代表你登录或调用 API 的 OAuth 客户端。",
};

const keys = {
	"Personal automation keys. 30-day expiry, 60 requests per minute.": "个人自动化密钥。30 天有效期，每分钟 60 次请求。",
	"New key": "新建密钥",
	"No API keys.": "还没有 API 密钥。",
	"Key": "密钥",
	"Created": "创建时间",
	"Expires": "过期时间",
	"Last used": "最后使用",
	"Revoke": "吊销",
	"Revoke this key?": "确定吊销该密钥？",
	"New API key": "新建 API 密钥",
	"Your new API key": "你的新 API 密钥",
	"Key name": "密钥名称",
	"Create": "创建",
};

const resources = {
	"HTTPS APIs (e.g. MCP servers) that accept MSAuth tokens. Token audience is pinned to the exact identifier.": "接受 MSAuth token 的 HTTPS API（如 MCP 服务器）。token 受众固定为精确的标识符。",
	"No resources registered.": "还没有注册资源。",
	"Identifier": "标识符",
	"TTL": "TTL",
	"DPoP required": "要求 DPoP",
	"Register resource": "注册资源",
	"Register": "注册",
	"Link client to resource": "关联客户端与资源",
	"Resource identifier": "资源标识符",
	"Link": "关联",
};

const agents = {
	// agents + delegations
	"Agent instances acting on your behalf. Each one is pinned to an OAuth client and a DPoP key fingerprint.": "代表你执行任务的代理实例。每个代理都绑定到一个 OAuth 客户端和一个 DPoP 密钥指纹。",
	"Register agent": "注册代理",
	"No agents registered.": "还没有注册代理。",
	"Client": "客户端",
	"Client ID": "客户端 ID",
	"DPoP key": "DPoP 密钥",
	"not bound": "未绑定",
	"Revoke this agent, its delegations and tokens?": "确定吊销该代理及其委托和 token？",
	"Description": "描述",
	"OAuth client ID": "OAuth Client ID",
	"Optional now — the agent can also self-register via DCR later.": "现阶段可选 — 代理稍后也可以通过 DCR 自行注册。",
	"Agent public key (P-256 JWK)": "代理公钥（P-256 JWK）",
	"Public key only. Tokens will be DPoP-bound to its thumbprint.": "只需公钥。token 将 DPoP 绑定到其指纹。",
	"Public key must be valid JSON": "公钥必须是合法的 JSON",
	"Explicit consent for an agent to act as you on one resource. Authority only ever narrows, up to 4 hops.": "明确授权某个代理在单一资源上以你的身份行事。权限只能逐级收窄，最多 4 层。",
	"New delegation": "新建委托",
	"No delegations.": "还没有委托。",
	"Agent": "代理",
	"Scopes / permissions": "权限范围 / 授权明细",
	"Depth": "深度",
	"chain": "链式",
	"Revoke this delegation (and any children)?": "确定吊销该委托（含其子委托）？",
	"Register an agent bound to an OAuth client and a DPoP key first — a delegation needs both.": "请先注册一个绑定 OAuth 客户端和 DPoP 密钥的代理 — 委托两者缺一不可。",
	"Scopes": "权限范围",
	"Parent delegation (optional)": "父委托（可选）",
	"Children may only narrow the parent's authority and expiry.": "子委托只能收窄父委托的权限和有效期。",
	"Expires at": "过期时间",
	"Between one minute and 30 days from now.": "介于 1 分钟到 30 天之后。",
	"Expiry must be between one minute and 30 days from now.": "过期时间必须介于 1 分钟到 30 天之后。",
	"Grant": "授权",
};

const security = {
	// audit + sessions + alerts
	"Every mutation on the platform, filterable by actor or resource.": "平台上的所有变更操作，可按操作者或资源筛选。",
	"Every mutation you performed.": "你执行过的所有变更操作。",
	"Actor user ID": "操作者用户 ID",
	"Resource type or ID": "资源类型或 ID",
	"Nothing recorded for this filter.": "该筛选条件下没有记录。",
	"Actor": "操作者",
	"Detail": "详情",
	"Active browser sessions on your account.": "你账户上活跃的浏览器会话。",
	"No sessions.": "没有会话。",
	"User agent": "User-Agent",
	"Revoke this session?": "确定吊销该会话？",
	"Security alerts": "安全告警",
	"Sign-in anomalies and token events for your account.": "你账户的登录异常和 token 事件。",
	"No alerts. Quiet is good.": "没有告警。安静是好事。",
	"Kind": "类型",
	"ack": "已确认",
	"Acknowledge": "确认",
};

const admin = {
	// users + settings + domains
	"Platform identities. Suspension revokes agents, delegations, clients and keys.": "平台上的用户身份。封禁会同时吊销其代理、委托、客户端和密钥。",
	"Search email or name": "搜索邮箱或名称",
	"No matching users.": "没有匹配的用户。",
	"User": "用户",
	"Verified": "已验证",
	"2FA": "两步验证",
	"Suspend": "封禁",
	"Suspension reason?": "封禁原因？",
	"Unsuspend": "解除封禁",
	"User detail": "用户详情",
	"Linked accounts": "关联账号",
	"Provider": "提供商",
	"Linked": "关联时间",
	"Account ID": "账号 ID",
	"Suspend user": "封禁用户",
	"Suspending revokes this user's agents, delegations, clients and keys.": "封禁将同时吊销该用户的代理、委托、客户端和密钥。",
	"Ban and revoke everything this user controls.": "封禁并吊销该用户控制的一切。",
	"User ID": "用户 ID",
	"Email address": "邮箱地址",
	"Platform settings": "平台设置",
	"Issuer:": "签发方（Issuer）：",
	"Registration": "开放注册",
	"Allow new users to sign up (GitHub). Allowlisted admins can always sign in.": "允许新用户注册（GitHub）。白名单管理员始终可以登录。",
	"Dynamic client registration": "动态客户端注册",
	"Allow unauthenticated OAuth clients to self-register (RFC 7591) — required for MCP client auto-discovery.": "允许未经认证的 OAuth 客户端自行注册（RFC 7591）— MCP 客户端自动发现所必需。",
	"Prove ownership of the domains your resources run on.": "证明你对资源所在域名的所有权。",
	"Add domain": "添加域名",
	"Hostname": "主机名",
	"Add": "添加",
	"Your domains": "你的域名",
	"No domains added.": "还没有添加域名。",
	"TXT record": "TXT 记录",
	"Value": "值",
	"Verify": "验证",
};

const toasts = {
	// success toasts
	"Application created.": "应用已创建。",
	"Application updated.": "应用已更新。",
	"Client secret rotated.": "客户端密钥已轮换。",
	"Application deleted.": "应用已删除。",
	"API key created.": "API 密钥已创建。",
	"API key revoked.": "API 密钥已吊销。",
	"Resource registered.": "资源已注册。",
	"Client linked to resource.": "客户端已关联到资源。",
	"Agent registered.": "代理已注册。",
	"Agent revoked.": "代理已吊销。",
	"Delegation granted.": "委托已创建。",
	"Delegation revoked.": "委托已吊销。",
	"Session revoked.": "会话已吊销。",
	"Alert acknowledged.": "告警已确认。",
	"User suspended.": "用户已封禁。",
	"User unsuspended.": "已解除封禁。",
	"Settings saved.": "设置已保存。",
	"Domain added.": "域名已添加。",
	"Domain verified.": "域名已验证。",
};

const dev = {
	// /dev component catalog (console-gated, linked nowhere public)
	"Component catalog": "组件目录",
	"Documentation-as-code: every primitive, every state.": "文档即代码：所有原语与状态。",
	"Buttons": "按钮",
	"Tags & badges": "标签与徽章",
	"Dialogs": "对话框",
	"Open modal": "打开对话框",
	"This is a modal.": "这是一个对话框。",
	"Open confirm": "打开确认框",
	"Delete everything?": "确定删除一切？",
	"Confirmed": "已确认",
	"Cancelled": "已取消",
	"Toasts": "通知",
	"Fire success toast": "发送成功通知",
	"Fire error toast": "发送错误通知",
	"Fire info toast": "发送信息通知",
	"Toast with action": "带操作的通知",
	"Undo": "撤销",
	"Copy & identifiers": "复制与标识",
	"Masked by default;": "默认遮蔽；",
	"shows the value in full.": "完整显示该值。",
	"Skeletons": "骨架屏",
	"Empty states": "空状态",
	"A hint line under the title.": "标题下的一行提示。",
	"Table toolbar": "表格工具栏",
	"Palette & preferences": "命令面板与偏好",
	"Open palette": "打开命令面板",
	"Data viz": "数据可视化",
};

/** Audit action codes, keyed by the exact string the backend writes to auditEvent. */
const actions = {
	// src/iam/agents.ts
	"agent.created": "注册代理",
	"agent.revoked": "吊销代理",
	"delegation.created": "创建委托",
	"delegation.revoked": "吊销委托",
	// src/agent/exchange.ts
	"token.exchanged": "交换 token",
	// src/iam/governance.ts
	"user.suspended": "封禁用户",
	"user.unsuspended": "解封用户",
	"session.revoked": "吊销会话",
	"settings.updated": "更新平台设置",
	"domain.added": "添加域名",
	"domain.verified": "验证域名",
	// src/iam/developers.ts
	"application.created": "创建应用",
	"application.updated": "更新应用",
	"application.deleted": "删除应用",
	"application.secret_rotated": "轮换应用密钥",
	"registration.revoked": "吊销注册应用",
	"key.created": "创建 API 密钥",
	"key.revoked": "吊销 API 密钥",
	"resource.created": "注册资源",
	"resource.linked": "关联客户端与资源",
};

/** English string is the key; zh maps it to Simplified Chinese. Missing keys fall back to English. */
export const zh: Record<string, string> = {
	...common,
	...nav,
	...auth,
	...overview,
	...applications,
	...keys,
	...resources,
	...agents,
	...security,
	...admin,
	...toasts,
	...dev,
	...actions,
};

interface LangContextValue {
	lang: Lang;
	setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "zh", setLang: () => undefined });

function initialLang(): Lang {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "zh" || stored === "en") return stored;
	} catch {
		// storage unavailable — fall through to default
	}
	return "zh";
}

export function LangProvider(props: { children: ReactNode }) {
	const [lang, setLang] = useState<Lang>(initialLang);
	const firstRun = useRef(true);
	useEffect(() => {
		document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
		try {
			localStorage.setItem(STORAGE_KEY, lang);
		} catch {
			// storage unavailable — language still applies for this session
		}
	}, [lang]);
	// Brief opacity dip on the document when the language flips — masks the
	// re-render flash. Skipped on first mount and under prefers-reduced-motion.
	useEffect(() => {
		if (firstRun.current) {
			firstRun.current = false;
			return undefined;
		}
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
		const root = document.documentElement;
		root.classList.add("lang-dip");
		const release = () => root.classList.remove("lang-dip");
		const onEnd = (event: TransitionEvent) => {
			if (event.target === document.body && event.propertyName === "opacity") release();
		};
		root.addEventListener("transitionend", onEnd);
		const safety = window.setTimeout(release, 240); // transitions may never fire
		return () => {
			root.removeEventListener("transitionend", onEnd);
			window.clearTimeout(safety);
			release();
		};
	}, [lang]);
	const value = useMemo(() => ({ lang, setLang }), [lang]);
	return <LangContext.Provider value={value}>{props.children}</LangContext.Provider>;
}

export function useT() {
	const { lang } = useContext(LangContext);
	return useCallback((key: string, vars?: Record<string, string | number>) => {
		const text = lang === "zh" ? (zh[key] ?? key) : key;
		if (!vars) return text;
		return Object.entries(vars).reduce(
			(acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
			text,
		);
	}, [lang]);
}

/** Lang + setter for language-switch affordances outside the segmented control. */
export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
	return useContext(LangContext);
}

/**
 * Audit action code → label. Chinese label when translated, raw code as
 * fallback (and in EN mode, since codes are technical identifiers).
 */
export function tAction(code: string, lang: Lang = "zh"): string {
	if (lang !== "zh") return code;
	return zh[code] ?? code;
}

/** Lang-aware `tAction` for components. */
export function useActionLabel(): (code: string) => string {
	const { lang } = useContext(LangContext);
	return useCallback((code: string) => tAction(code, lang), [lang]);
}

/** Compact segmented `中文 | EN` control — reads as a setting, not a button. */
export function LangSegmented() {
	const { lang, setLang } = useContext(LangContext);
	const t = useT();
	return (
		<div className="lang-seg" role="group" aria-label={t("Language")}>
			<span className="lang-thumb" data-lang={lang} aria-hidden="true" />
			<button type="button" className={lang === "zh" ? "active" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中文</button>
			<button type="button" className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
		</div>
	);
}
