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

Git 连接 Cloudflare Workers Builds，推送即自动部署：
`predeploy` 自动确保 D1 数据库存在（删除后也会自动重建）、应用迁移，随后部署 Worker。

必需配置（Secrets Store）：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`ADMIN_EMAIL`。

### 完全重建

删除 D1 数据库（或换环境）后重新部署即可：构建会自动重建同名数据库
`openauth-db`、应用全部迁移（`migrations/0001_schema.sql` + `0002_seed.sql`）。
Secrets（Secrets Store）与 KV 命名空间不受删除数据库影响。

详细开发规范见 [AGENTS.md](AGENTS.md)。