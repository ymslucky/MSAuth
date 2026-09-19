/**
 * Public "signed in" page for regular (non-admin) users: shows who they are
 * and lets them sign out. Hand-drawn sketch style, zero scripts.
 */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderMePage(opts: { email: string; roles: string[] }): string {
	const roleChips = opts.roles.length
		? opts.roles
				.map(
					(r) =>
						`<span class="chip">${r === "admin" ? "⭐ " : ""}${esc(r)}</span>`,
				)
				.join("")
		: '<span class="chip none">无角色</span>';
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>我的账户 · MSAuth</title>
<style>
  :root {
    --paper: #fbf7ee; --card: #fffdf6; --ink: #33302a; --ink-soft: #7a7062;
    --line: #d9d2c0; --primary: #2f5ac9; --primary-dark: #2447a3; --highlight: #ffe98a;
    --radius-sketch: 255px 15px 225px 15px / 15px 225px 15px 255px;
    --shadow-sketch: 4px 5px 0 rgba(51, 48, 42, 0.22);
    --font-hand: "Segoe Print", "Comic Sans MS", "Kaiti SC", "楷体", "STKaiti", cursive;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-hand); color: var(--ink);
    background:
      repeating-linear-gradient(transparent 0 30px, rgba(47, 90, 201, 0.05) 30px 31px),
      var(--paper);
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: var(--card); border: 2px solid var(--ink);
    border-radius: var(--radius-sketch); box-shadow: var(--shadow-sketch);
    padding: 40px 44px; max-width: 440px; width: 100%; text-align: center;
    transform: rotate(-0.4deg); position: relative;
  }
  .tape {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%) rotate(-2deg);
    width: 110px; height: 26px; background: rgba(255, 233, 138, 0.75);
    border-left: 1px dashed rgba(51,48,42,0.25); border-right: 1px dashed rgba(51,48,42,0.25);
  }
  h1 { font-size: 24px; display: inline-block; border-bottom: 3px dashed var(--ink-soft); padding: 0 12px 5px; margin-bottom: 16px; transform: rotate(-0.5deg); }
  .avatar {
    width: 64px; height: 64px; margin: 0 auto 14px; background: var(--highlight);
    border: 2px solid var(--ink); border-radius: 50% 42% 55% 45% / 45% 55% 42% 50%;
    font-size: 30px; line-height: 60px; box-shadow: 2px 3px 0 rgba(51,48,42,0.25);
  }
  .email { font-size: 16px; font-weight: 700; margin-bottom: 10px; word-break: break-all; }
  .roles { margin-bottom: 26px; }
  .chip {
    display: inline-block; background: #f3eede; border: 1.5px solid var(--ink-soft);
    border-radius: 30px 8px 26px 9px / 9px 26px 8px 30px; padding: 3px 12px;
    font-size: 12px; margin: 2px 3px;
  }
  .chip.none { color: var(--ink-soft); }
  .links { display: flex; flex-direction: column; gap: 10px; }
  a.btn {
    display: block; padding: 11px 16px; text-decoration: none; font-size: 14px;
    color: var(--ink); background: var(--card); border: 2px solid var(--ink);
    border-radius: 12px 4px 14px 5px / 5px 14px 4px 12px; box-shadow: 3px 3px 0 rgba(51,48,42,0.28);
    font-family: var(--font-hand);
  }
  a.btn:hover { transform: translate(-1px, -1px) rotate(-0.8deg); box-shadow: 4px 5px 0 rgba(51,48,42,0.28); }
  a.btn.danger { color: #c94436; border-color: #c94436; }
  a.btn.danger:hover { background: #fdecea; }
  footer { margin-top: 20px; font-size: 12px; color: var(--ink-soft); }
</style>
</head>
<body>
<main class="card">
  <div class="tape"></div>
  <h1>我的账户</h1>
  <div class="avatar">🙂</div>
  <div class="email">${esc(opts.email)}</div>
  <div class="roles">${roleChips}</div>
  <nav class="links">
    <a class="btn danger" href="/admin/logout">退出登录</a>
    <a class="btn" href="/">返回主页</a>
  </nav>
  <footer>MSAuth</footer>
</main>
</body>
</html>`;
}