import { TOKENS_CSS } from "./ui/tokens";
import { FAVICON_DATA_URI } from "./favicon";
/**
 * Public homepage for the auth server. Fully static: no scripts, no query
 * parameter reflection, strict CSP. Hand-drawn sketch design system.
 */
export function renderHomePage(): string {
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
	<link rel="icon" href="${FAVICON_DATA_URI}">
<title>MSAuth · 身份认证服务</title>
<style>
  ${TOKENS_CSS}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-hand);
    color: var(--ink);
    background:
      repeating-linear-gradient(transparent 0 30px, rgba(47, 90, 201, 0.05) 30px 31px),
      var(--paper);
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: var(--card); border: 2px solid var(--ink);
    border-radius: var(--radius-sketch); box-shadow: var(--shadow-sketch);
    padding: 42px 44px; max-width: 480px; width: 100%; text-align: center;
    transform: rotate(-0.5deg); position: relative;
  }
  .tape {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%) rotate(2deg);
    width: 110px; height: 26px; background: rgba(255, 233, 138, 0.75);
    border-left: 1px dashed rgba(51,48,42,0.25); border-right: 1px dashed rgba(51,48,42,0.25);
  }
  .logo {
    width: 58px; height: 58px; margin: 6px auto 16px;
    background: var(--highlight); border: 2px solid var(--ink);
    border-radius: 50% 42% 55% 45% / 45% 55% 42% 50%;
    font-size: 30px; font-weight: 700; line-height: 56px;
    box-shadow: 2px 3px 0 rgba(51,48,42,0.25);
  }
  h1 {
    font-size: 34px; letter-spacing: 0.02em; display: inline-block;
    border-bottom: 3px dashed var(--ink-soft); padding: 0 14px 6px; margin-bottom: 8px;
    transform: rotate(-0.6deg);
  }
  .sub { color: var(--ink-soft); font-size: 15px; margin-bottom: 18px; }
  .status {
    display: inline-flex; align-items: center; gap: 7px; font-size: 13px;
    background: var(--highlight); border: 2px solid var(--ink);
    border-radius: 30px 8px 26px 9px / 9px 26px 8px 30px;
    padding: 4px 14px; margin-bottom: 28px; box-shadow: 2px 2px 0 rgba(51,48,42,0.2);
  }
  .dot { width: 8px; height: 8px; border-radius: 50% 40% 55% 45%; background: var(--ok); border: 1.5px solid var(--ink); }
  .links { display: flex; flex-direction: column; gap: 12px; margin-bottom: 26px; }
  a.btn {
    display: block; padding: 12px 16px; text-decoration: none;
    font-size: 15px; font-family: var(--font-hand);
    color: var(--ink); background: var(--card);
    border: 2px solid var(--ink); border-radius: 12px 4px 14px 5px / 5px 14px 4px 12px;
    box-shadow: 3px 3px 0 rgba(51,48,42,0.28);
  }
  a.btn:hover { transform: translate(-1px, -1px) rotate(-0.8deg); box-shadow: 4px 5px 0 rgba(51,48,42,0.28); }
  a.btn.primary { background: var(--primary); border-color: var(--primary-dark); color: #fff; }
  a.btn.primary:hover { background: var(--primary-dark); }
  .endpoints { text-align: left; border-top: 2px dashed var(--line); padding-top: 18px; }
  .endpoints h2 {
    font-size: 12px; color: var(--ink-soft); font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px;
  }
  .endpoints code {
    display: block; font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    background: #f3eede; border: 1.5px solid var(--line); border-radius: 8px 3px 10px 4px / 4px 10px 3px 8px;
    padding: 6px 10px; margin-bottom: 5px; color: var(--ink);
  }
  footer { margin-top: 22px; font-size: 12px; color: var(--ink-soft); }
</style>
</head>
<body>
<main class="card">
  <div class="tape"></div>
  <div class="logo">M</div>
  <h1>MSAuth</h1>
  <p class="sub">身份验证服务</p>
  <nav class="links">
    <a class="btn primary" href="/login">登 录</a>
  </nav>
  <footer>MSAuth</footer>
</main>
</body>
</html>`;
}