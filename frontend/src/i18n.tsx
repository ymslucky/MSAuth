import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "msauth-lang";

/** English string is the key; zh maps it to Simplified Chinese. Missing keys fall back to English. */
export const zh: Record<string, string> = {
	// shell / nav
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
	"Loading…": "加载中…",
	"Platform administrator access required.": "需要平台管理员权限。",
	"operator": "管理员",
	"Sign out": "退出登录",
	"Unknown page.": "未知页面。",

	// login
	"Sign in to your identity console.": "登录你的身份控制台。",
	"Email": "邮箱",
	"Password": "密码",
	"Sign in": "登录",
	"or": "或",
	"Continue with GitHub": "使用 GitHub 继续",
	"GitHub sign-in is not configured": "GitHub 登录尚未配置",

	// consent
	"Authorize application": "授权应用",
	"is requesting access to your identity.": "正在请求访问你的身份。",
	"Resource:": "资源：",
	"Requested scopes": "请求的权限范围",
	"No scopes requested": "未请求任何权限",
	"Allow": "允许",
	"Deny": "拒绝",
	"Consent response did not include a redirect": "授权响应未包含跳转地址",

	// overview
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

	// applications
	"OAuth clients you own. Callback URLs are exact-match; DPoP-bound clients get proof-key tokens.": "你拥有的 OAuth 客户端。回调 URL（Redirect URI）精确匹配；启用 DPoP 的客户端会获得证明密钥绑定的 token。",
	"New application": "新建应用",
	"No applications yet.": "还没有应用。",
	"Name": "名称",
	"Callbacks": "回调 URL",
	"Status": "状态",
	"disabled": "已禁用",
	"active": "正常",
	"Edit": "编辑",
	"Rotate": "轮换密钥",
	"Rotate this client secret?": "确定轮换该客户端密钥？",
	"Delete": "删除",
	"Delete this application and all its tokens?": "确定删除该应用及其所有 token？",
	"New client secret": "新的 Client Secret",
	"Edit application": "编辑应用",
	"Callback URLs": "回调 URL",
	"One per line. Exact HTTPS URLs, or http loopback for native apps.": "每行一个。必须是精确的 HTTPS URL，原生应用可用 http 回环地址。",
	"Confidential client (client secret)": "机密客户端（使用 client secret）",
	"Require DPoP-bound tokens": "要求 DPoP 绑定的 token",
	"Save": "保存",
	"Cancel": "取消",
	"Copy it now — this value is never shown again.": "请立即复制 — 该值不会再显示。",
	"Done": "完成",

	// API keys
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

	// resources
	"HTTPS APIs (e.g. MCP servers) that accept MSAuth tokens. Token audience is pinned to the exact identifier.": "接受 MSAuth token 的 HTTPS API（如 MCP 服务器）。token 受众固定为精确的标识符。",
	"No resources registered.": "还没有注册资源。",
	"Identifier": "标识符",
	"TTL": "TTL",
	"DPoP required": "要求 DPoP",
	"yes": "是",
	"no": "否",
	"Register resource": "注册资源",
	"Register": "注册",
	"Link client to resource": "关联客户端与资源",
	"Resource identifier": "资源标识符",
	"Link": "关联",

	// agents
	"Agent instances acting on your behalf. Each one is pinned to an OAuth client and a DPoP key fingerprint.": "代表你执行任务的代理实例。每个代理都绑定到一个 OAuth 客户端和一个 DPoP 密钥指纹。",
	"Register agent": "注册代理",
	"No agents registered.": "还没有注册代理。",
	"Client": "客户端",
	"DPoP key": "DPoP 密钥",
	"not bound": "未绑定",
	"revoked": "已撤销",
	"Revoke this agent, its delegations and tokens?": "确定吊销该代理及其委托和 token？",
	"Description": "描述",
	"OAuth client ID": "OAuth Client ID",
	"Optional now — the agent can also self-register via DCR later.": "现阶段可选 — 代理稍后也可以通过 DCR 自行注册。",
	"Agent public key (P-256 JWK)": "代理公钥（P-256 JWK）",
	"Public key only. Tokens will be DPoP-bound to its thumbprint.": "只需公钥。token 将 DPoP 绑定到其指纹。",
	"Public key must be valid JSON": "公钥必须是合法的 JSON",

	// delegations
	"Explicit consent for an agent to act as you on one resource. Authority only ever narrows, up to 4 hops.": "明确授权某个代理在单一资源上以你的身份行事。权限只能逐级收窄，最多 4 层。",
	"New delegation": "新建委托",
	"No delegations.": "还没有委托。",
	"Agent": "代理",
	"Scopes / permissions": "权限范围 / 授权明细",
	"Depth": "深度",
	"chain": "链式",
	"expired": "已过期",
	"live": "生效中",
	"Revoke this delegation (and any children)?": "确定吊销该委托（含其子委托）？",
	"Register an agent bound to an OAuth client and a DPoP key first — a delegation needs both.": "请先注册一个绑定 OAuth 客户端和 DPoP 密钥的代理 — 委托两者缺一不可。",
	"Close": "关闭",
	"Scopes": "权限范围",
	"Parent delegation (optional)": "父委托（可选）",
	"Children may only narrow the parent's authority and expiry.": "子委托只能收窄父委托的权限和有效期。",
	"Expires at": "过期时间",
	"Between one minute and 30 days from now.": "介于 1 分钟到 30 天之后。",
	"Grant": "授权",

	// audit
	"Every mutation on the platform, filterable by actor or resource.": "平台上的所有变更操作，可按操作者或资源筛选。",
	"Every mutation you performed.": "你执行过的所有变更操作。",
	"Actor user ID": "操作者用户 ID",
	"Resource type or ID": "资源类型或 ID",
	"Nothing recorded for this filter.": "该筛选条件下没有记录。",
	"Actor": "操作者",
	"Detail": "详情",
	"← Prev": "← 上一页",
	"Next →": "下一页 →",

	// sessions
	"Active browser sessions on your account.": "你账户上活跃的浏览器会话。",
	"No sessions.": "没有会话。",
	"User agent": "User-Agent",
	"current": "当前",
	"Revoke this session?": "确定吊销该会话？",

	// alerts
	"Security alerts": "安全告警",
	"Sign-in anomalies and token events for your account.": "你账户的登录异常和 token 事件。",
	"No alerts. Quiet is good.": "没有告警。安静是好事。",
	"Kind": "类型",
	"ack": "已确认",
	"Acknowledge": "确认",

	// users
	"Platform identities. Suspension revokes agents, delegations, clients and keys.": "平台上的用户身份。封禁会同时吊销其代理、委托、客户端和密钥。",
	"Search email or name": "搜索邮箱或名称",
	"No matching users.": "没有匹配的用户。",
	"User": "用户",
	"Verified": "已验证",
	"2FA": "两步验证",
	"on": "开",
	"off": "关",
	"suspended": "已封禁",
	"Suspend": "封禁",
	"Suspension reason?": "封禁原因？",
	"Unsuspend": "解除封禁",
	"User detail": "用户详情",
	"None.": "无。",
	"Linked accounts": "关联账号",
	"Provider": "提供商",
	"Linked": "关联时间",

	// settings
	"Platform settings": "平台设置",
	"Issuer:": "签发方（Issuer）：",
	"Registration": "开放注册",
	"Allow new users to sign up (GitHub). Allowlisted admins can always sign in.": "允许新用户注册（GitHub）。白名单管理员始终可以登录。",
	"Dynamic client registration": "动态客户端注册",
	"Allow unauthenticated OAuth clients to self-register (RFC 7591) — required for MCP client auto-discovery.": "允许未经认证的 OAuth 客户端自行注册（RFC 7591）— MCP 客户端自动发现所必需。",

	// domains
	"Prove ownership of the domains your resources run on.": "证明你对资源所在域名的所有权。",
	"Add domain": "添加域名",
	"Hostname": "主机名",
	"Add": "添加",
	"Your domains": "你的域名",
	"No domains added.": "还没有添加域名。",
	"TXT record": "TXT 记录",
	"Value": "值",
	"verified": "已验证",
	"pending": "待验证",
	"Verify": "验证",

	// redesign: shared primitives
	"Retry": "重试",
	"Copy": "复制",
	"Copied": "已复制",
	"Confirm": "确认",
	"Something went wrong.": "出了点问题。",

	// redesign: login brand panel
	"A quiet ledger for identity.": "一本安静的身份账簿。",
	"MSAuth is the identity layer for individuals and one-person companies — OAuth clients, API keys and DPoP-bound agents, governed from one console.": "MSAuth 是面向个人与一人公司的身份层 —— OAuth 客户端、API 密钥与 DPoP 绑定的代理，尽在一个控制台治理。",
	"OAuth 2.1 clients and API keys": "OAuth 2.1 客户端与 API 密钥",
	"DPoP-bound agents with audited delegation chains": "DPoP 绑定的代理与可审计的委托链",
	"Every mutation on the record": "所有变更皆有审计记录",

	// redesign: success toasts
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

	// redesign: forms
	"Expiry must be between one minute and 30 days from now.": "过期时间必须介于 1 分钟到 30 天之后。",

	// redesign: users
	"Suspend user": "封禁用户",
	"Suspending revokes this user's agents, delegations, clients and keys.": "封禁将同时吊销该用户的代理、委托、客户端和密钥。",
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
	useEffect(() => {
		document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
		try {
			localStorage.setItem(STORAGE_KEY, lang);
		} catch {
			// storage unavailable — language still applies for this session
		}
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

export function LanguageToggle() {
	const { lang, setLang } = useContext(LangContext);
	return (
		<button type="button" className="btn ghost lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
			{lang === "zh" ? "EN" : "中文"}
		</button>
	);
}
