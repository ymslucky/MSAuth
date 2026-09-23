# MSAuth

面向个人、极客与一人公司的 IAM 统一平台，原生支持 AI Agent 与 MCP 授权。

部署于 Cloudflare Workers（D1 + Secrets Store），技术栈 **Hono + Better Auth**。
定位不是企业级 IAM 的简化版，而是轻量、开发者体验优先、原生面向 AI Agent 时代的身份基础设施。

## 功能

- **认证**：邮箱密码、GitHub OAuth、Passkey、两步验证（Better Auth 插件化）
- **OAuth 2.1 Provider**：PKCE、Consent、DCR 动态客户端注册（MCP 客户端自动接入）
- **Agent 授权**：DPoP 令牌绑定、RAR 细粒度权限（`mcp_tool`）、RFC 8693 Token Exchange
  委托链（只可收窄、深度 ≤ 4、令牌 ≤ 5 分钟、aud 锁定单一 HTTPS 资源）
- **开发者控制台 SPA**：OAuth 应用、API Key、资源注册、Agent 注册与委托管理、
  审计日志、会话与安全告警、用户与平台设置、域名验证
- **Agent SDK**（`sdk/`）：把 PKCE + DPoP + Token Exchange 封装成几行代码，运行时无关
- **安全**：管理 API 仅接受浏览器会话（剥离 Authorization / x-api-key）、同源变更校验、
  按 IP 限速、CSP、每步变更写审计

## 技术栈

Cloudflare Workers · Hono · Better Auth · D1 · Workers Assets (React SPA) · Vitest（workerd 集成测试）

## 开发

```powershell
npm install
npm test          # 集成测试（workerd 内运行）
npm run check     # tsc（主工程 + SPA）+ SPA 构建 + wrangler deploy --dry-run
npm run db:schema # 从 Better Auth 插件配置重新生成 migrations/0001_schema.sql
```

前端在 [frontend/](frontend)（Vite + React），`npm run build:spa` 构建，
由 Workers Assets 托管（SPA fallback）；`/api`、`/.well-known` 始终走 Worker。

## 部署

```powershell
npm run deploy    # predeploy 自动建库（msauth-db）+ 应用迁移，构建 SPA 后部署
```

生产域名：`auth.msxor.com`（`wrangler.json` 中以 custom domain 绑定）。

必需配置：

- 四个密钥统一托管在 Cloudflare Secrets Store，经 `wrangler.json` 的 `secrets_store_secrets`
  绑定到 Worker：`BETTER_AUTH_SECRET`（≥ 32 字符）、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、
  `ADMIN_EMAIL`（管理员白名单，逗号分隔、大小写不敏感；缺失时 GitHub 登录与管理台优雅降级）

## 客户端接入

MCP Server 将自身声明为受保护资源，指向本授权服务器：

```ts
import { createProtectedResourceMetadata, authorizeToolCall } from "msauth/sdk";

// /.well-known/oauth-protected-resource
createProtectedResourceMetadata("https://mcp.example.com/mcp", "https://auth.msxor.com");

// 每个工具调用前
authorizeToolCall(claims, "https://mcp.example.com/mcp", "notes", "read");
```

Agent 侧（完整示例见 [sdk/index.ts](sdk/index.ts)）：

```ts
const agent = await AgentClient.create({ issuer, clientId, resource });
const flow = await agent.authorize(redirectUri, ["mcp:invoke"]);
const tokens = await agent.complete(callbackUrl, flow);
const res = await agent.fetch(`${resource}/tools/1`); // 自动附带 DPoP 证明
```

详细开发规范见 [AGENTS.md](AGENTS.md)。
