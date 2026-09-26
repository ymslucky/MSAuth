/**
 * i18n dictionary — pure data, no React (split from i18n.tsx so the provider
 * stays logic-only). Convention:
 *  - The English source string is the key; zh maps it to Simplified Chinese.
 *    Missing keys fall back to the English key itself (t() behaviour).
 *  - Technical terms (OAuth, DPoP, token, DCR, API key…) stay untranslated.
 *  - The dict is built from named per-area sections merged into one record —
 *    add new strings to the section they belong to, not to the bottom.
 *  - Audit action codes (e.g. "agent.created") live in the `actions` section,
 *    keyed by their backend code; render them via tAction()/useActionLabel().
 *  - test/frontend/i18nKeys.test.ts walks every t("…") call site against this
 *    dict — a missing key fails the suite.
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
	"Register an agent": "注册代理",
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
	"The resource must also be linked to the agent's OAuth client.": "该资源还需与代理的 OAuth 客户端关联。",
	"Choose a registered resource": "选择已注册的资源",
	"Actions": "操作",
	"Tool identifiers": "工具标识",
	"Comma-separated MCP actions, e.g. tools/list, tools/call.": "逗号分隔的 MCP 操作，如 tools/list、tools/call。",
	"Comma-separated MCP tool names this delegation may call.": "该委托可调用的 MCP 工具名，逗号分隔。",
	"Enter 1–32 comma-separated values — no blanks or *.": "填写 1–32 个逗号分隔的值，不能为空或包含 *。",
	"None (root delegation)": "无（根委托）",
	"No eligible parent for this agent and resource.": "该代理与资源没有可用的父委托。",
	"Expires at": "过期时间",
	"Between one minute and 30 days from now.": "介于 1 分钟到 30 天之后。",
	"Expiry must be between one minute and 30 days from now.": "过期时间必须介于 1 分钟到 30 天之后。",
	"Grant": "授权",
};

const security = {
	// audit + sessions + alerts
	"Every mutation on the platform, filterable by actor or resource.": "平台上的所有变更操作，可按操作者或资源筛选。",
	"Every mutation you performed.": "你执行过的所有变更操作。",
	"Actor email or ID": "操作者邮箱或 ID",
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
	"Dynamic client registrations": "动态注册的客户端",
	"OAuth clients that self-registered via RFC 7591. Revoking disables the client immediately.": "通过 RFC 7591 自注册的 OAuth 客户端。吊销会立即禁用该客户端。",
	"No self-registered clients.": "没有自注册的客户端。",
	"Redirect URIs": "重定向 URI",
	"Revoke this registration? The client loses access immediately.": "确定吊销该注册应用？客户端将立即失去访问能力。",
	"Registration revoked.": "注册应用已吊销。",
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

const docsArea = {
	// public /docs integration guide
	"Open console": "进入控制台",
	"Integration guide": "接入指南",
	"Four ways to connect third parties to MSAuth — pick the one that matches your caller.":
		"四类第三方接入 MSAuth 的方式——按你的调用方选择对应路径。",
	"On this page": "本页目录",
	"Documentation": "文档",
	"Markdown": "Markdown",
	"Copy markdown": "复制 Markdown",
	// section titles
	"Web & SPA applications": "Web 与 SPA 应用",
	"MCP servers & protected resources": "MCP 服务器与受保护资源",
	"AI agents & delegated authority": "AI Agent 与委托授权",
	"Machine-to-machine workloads": "机对机工作负载",
	// audiences
	"Third-party apps that sign users in with MSAuth.": "想让用户通过 MSAuth 登录的第三方应用。",
	"Resource servers that must validate a token on every tool call.":
		"每次工具调用都要校验令牌的资源服务器。",
	"Agents acting on a user's behalf under an explicit, narrowing delegation.":
		"在显式、只可收窄的委托之下代表用户行动的 Agent。",
	"Scripts, CI jobs and services without a user context.": "没有用户上下文的脚本、CI 任务与服务。",
	// web-app steps
	"Create an OAuth application in the console, or register dynamically through RFC 7591 DCR (public by default, kill-switchable).":
		"在控制台创建 OAuth 应用，或经 RFC 7591 DCR 动态注册（默认开放，可用开关关闭）。",
	"Start the authorization-code flow with PKCE (S256), a state parameter and an exact resource identifier.":
		"发起授权码流程：PKCE（S256）、state 参数与精确的 resource 标识。",
	"Show the hosted consent page, then swap the code for tokens at the token endpoint.":
		"展示托管 Consent 页，然后用 code 到 token 端点换取令牌。",
	"Access tokens live 5 minutes; refresh tokens rotate on every use — store only the latest one.":
		"访问令牌有效期 5 分钟；refresh token 每次使用都会轮换——只保存最新一枚。",
	"Authorization request": "授权请求",
	// mcp-server steps
	"An operator registers the resource: exact HTTPS identifier, 300-second token TTL, DPoP required.":
		"由 operator 注册资源：精确 HTTPS 标识、令牌 TTL 300 秒、强制 DPoP。",
	"Publish RFC 9728 metadata at /.well-known/oauth-protected-resource so MCP hosts discover this server.":
		"在 /.well-known/oauth-protected-resource 发布 RFC 9728 元数据，供 MCP Host 自动发现本服务器。",
	"Validate access tokens locally against the published JWKS: audience, expiry and the cnf.jkt DPoP binding.":
		"用发布的 JWKS 在本地校验访问令牌：audience、有效期与 cnf.jkt DPoP 绑定。",
	"Gate every tool call through the RAR helper — mcp_tool authorization details decide authority.":
		"每次工具调用都经 RAR 辅助函数把关——由 mcp_tool 授权明细决定权限。",
	"Resource server integration": "资源服务器接入",
	// agent steps
	"Register an agent in the console: bind an OAuth client plus a P-256 public JWK — the private key never leaves the agent.":
		"在控制台注册 Agent：绑定 OAuth 应用与 P-256 公钥 JWK——私钥永不出 Agent。",
	"Create a delegation: one exact resource, scopes, RAR details, lifetime between one minute and 30 days.":
		"创建委托：单一精确资源、scopes、RAR 明细，有效期 1 分钟至 30 天。",
	"Run the SDK flow: PKCE authorize (with dpop_jkt), code exchange, then a token exchange against the delegation.":
		"运行 SDK 流程：PKCE authorize（携带 dpop_jkt）→ code 换令牌 → 针对委托做 token exchange。",
	"Delegated tokens live at most 5 minutes, are DPoP-bound to the agent key, pin one audience and can never refresh.":
		"委托令牌有效期至多 5 分钟，DPoP 绑定 Agent 密钥、锁定单一 audience，且不可刷新。",
	"Agents may sub-delegate to child agents — narrowing only, chain depth up to 4.":
		"Agent 可向子 Agent 再委托——只可收窄，链深至多 4 层。",
	"Agent SDK": "Agent SDK",
	// m2m steps
	"Use a confidential client with the client_credentials grant for short-lived (300 s) service tokens.":
		"机密客户端使用 client_credentials 授权获取短效（300 秒）服务令牌。",
	"Or use an API key: msa_ prefix, 30-day default expiry, rate-limited per key.":
		"或使用 API Key：msa_ 前缀、默认 30 天过期、按 key 限速。",
	"API keys never open the management API — that surface is browser-session-only by design.":
		"API Key 永远打不开管理 API——该面按设计只接受浏览器会话。",
	// constraints
	"Platform invariants": "平台不变量",
	"Management API is browser-only": "管理 API 仅限浏览器",
	"All Authorization and x-api-key headers are stripped before session lookup; third-party tokens are never accepted there.":
		"会话查找前会剥离所有 Authorization 与 x-api-key 头；第三方令牌一律不被接受。",
	"Consent is explicit": "Consent 必须显式",
	"The /authorize endpoint rejects inline authorization_details — authority flows only through registered delegations.":
		"/authorize 端点拒绝内联 authorization_details——权限只能经注册的委托流动。",
	"Token lifetime is capped": "令牌有效期有上限",
	"Resource-scoped access tokens never exceed 300 seconds, and delegated tokens inherit the shortest chain expiry.":
		"资源作用域访问令牌不超过 300 秒，委托令牌继承链上最短的过期时间。",
	"Audience pinning": "Audience 锁定",
	"Every token is bound to exactly one HTTPS resource identifier and refuses to widen it.":
		"每枚令牌绑定且仅绑定一个 HTTPS 资源标识，拒绝扩大范围。",
};

const account = {
	// profile + credentials (console /account)
	"Account": "账户",
	"Your profile and sign-in credentials.": "你的个人资料与登录凭据。",
	"Display name": "显示名称",
	"Shown in the console and on consent screens.": "显示在控制台和授权确认页。",
	"Email": "邮箱",
	"Sign-in identity — managed by your sign-in provider.": "登录身份 — 由你的登录方式管理。",
	"Profile updated.": "资料已更新。",
	"Current password": "当前密码",
	"New password": "新密码",
	"Confirm new password": "确认新密码",
	"New password must be at least 8 characters.": "新密码至少需要 8 个字符。",
	"Passwords do not match.": "两次输入的密码不一致。",
	"Sign out other sessions": "退出其他会话",
	"Change password": "修改密码",
	"Password changes apply to accounts with a password credential; GitHub-only accounts keep using GitHub to sign in.": "密码修改仅适用于设置了密码的账户；仅使用 GitHub 登录的账户请继续通过 GitHub 登录。",
	"Password updated.": "密码已更新。",
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
	...account,
	...toasts,
	...dev,
	...docsArea,
	...actions,
};
