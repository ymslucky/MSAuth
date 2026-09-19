/**
 * Public homepage for the auth server. Fully static: no scripts, no query
 * parameter reflection, strict CSP.
 */
export function renderHomePage(): string {
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>myAuth · 身份认证服务</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #ffffff; --border: #e4e7ec; --text: #1a2233;
    --muted: #667085; --primary: #0051c3; --primary-dark: #0043a4; --ok: #067647;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg); color: var(--text); min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    padding: 40px; max-width: 460px; width: 100%; text-align: center;
  }
  .logo {
    width: 52px; height: 52px; border-radius: 14px; background: var(--primary);
    color: #fff; font-size: 26px; font-weight: 700; line-height: 52px; margin: 0 auto 18px;
  }
  h1 { font-size: 22px; margin-bottom: 6px; }
  .sub { color: var(--muted); font-size: 14px; margin-bottom: 18px; }
  .status {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
    color: var(--ok); background: #ecfdf3; border: 1px solid #abefc6;
    border-radius: 20px; padding: 3px 12px; margin-bottom: 26px;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
  .links { display: flex; flex-direction: column; gap: 10px; }
  a.btn {
    display: block; padding: 11px 16px; border-radius: 9px; text-decoration: none;
    font-size: 14px; border: 1px solid var(--border); color: var(--text); background: var(--card);
  }
  a.btn:hover { background: #f2f4f7; }
  a.btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
  a.btn.primary:hover { background: var(--primary-dark); }
  .endpoints { margin-top: 26px; text-align: left; }
  .endpoints h2 { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
  .endpoints code {
    display: block; font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    background: #f2f4f7; border-radius: 6px; padding: 6px 10px; margin-bottom: 4px; color: #3a445c;
  }
  footer { margin-top: 24px; font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<main class="card">
  <div class="logo">M</div>
  <h1>myAuth</h1>
  <p class="sub">自托管身份认证服务</p>
  <span class="status"><span class="dot"></span>服务运行中</span>
  <nav class="links">
    <a class="btn primary" href="/admin/login">管理控制台</a>
    <a class="btn" href="/.well-known/openid-configuration">OpenID 配置</a>
    <a class="btn" href="/.well-known/jwks.json">JWKS 公钥</a>
  </nav>
  <div class="endpoints">
    <h2>OAuth 2.0 / OIDC 端点</h2>
    <code>GET /authorize</code>
    <code>POST /token</code>
    <code>GET /github/authorize</code>
    <code>GET /password/authorize</code>
  </div>
  <footer>myAuth · OpenAuth on Cloudflare Workers</footer>
</main>
</body>
</html>`;
}