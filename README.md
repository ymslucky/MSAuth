# MSAuth

自托管身份认证服务（OpenAuth on Cloudflare Workers）。

基于 [OpenAuth](https://openauth.js.org/) 构建，部署于 Cloudflare Workers，
为应用提供 OAuth 2.0 / OIDC 认证能力，并内置 RBAC 权限的管理控制台。

## 功能

- **认证方式**：GitHub OAuth、邮箱密码（需自行接入邮件服务）
- **RBAC 权限**：角色 / 权限 / 用户-角色 / 角色-权限 完整模型，管理界面可视化操作
- **管理控制台**：`/admin`（通过本服务自身 OAuth 登录，`ADMIN_EMAIL` 白名单授予管理员）
- **安全**：PKCE、服务端可吊销会话、按 IP 限速、nonce CSP、审计日志、声明式自愈 schema
- **客户端集成**：subject JWT 携带 `roles` 声明；发现端点 `/.well-known/openid-configuration`

## 技术栈

Cloudflare Workers · Hono · D1 · KV · Secrets Store · Vitest（workerd 集成测试）

## 开发

```powershell
npm install
npm test          # 55+ 集成测试
npm run check     # tsc + wrangler deploy --dry-run
```

## 部署

Git 连接 Cloudflare Workers Builds，推送即自动部署
（`predeploy` 应用 D1 迁移；Worker 冷启动时 `ensureSchema` 自动对账 schema）。

必需配置（Secrets Store）：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`ADMIN_EMAIL`。

详细开发规范见 [AGENTS.md](AGENTS.md)。