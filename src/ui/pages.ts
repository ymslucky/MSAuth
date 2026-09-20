/** Sketch-style error pages (no scripts). */
const T = String.fromCharCode(96);

function shell(title: string, code: string, message: string): string {
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · MSAuth</title>
<style>
  :root {
    --paper: #fbf7ee; --card: #fffdf6; --ink: #33302a; --ink-soft: #7a7062;
    --primary: #2f5ac9; --highlight: #ffe98a;
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
  .code { font-size: 52px; font-weight: 700; display: inline-block;
    background: var(--highlight); border: 2px solid var(--ink);
    border-radius: 30px 8px 26px 9px / 9px 26px 8px 30px; padding: 4px 18px;
    margin-bottom: 16px; transform: rotate(-1deg);
  }
  h1 { font-size: 20px; margin-bottom: 8px; }
  p { color: var(--ink-soft); font-size: 14px; margin-bottom: 24px; }
  a.btn {
    display: inline-block; padding: 11px 18px; text-decoration: none; font-size: 14px;
    color: #fff; background: var(--primary); border: 2px solid var(--ink);
    border-radius: 12px 4px 14px 5px / 5px 14px 4px 12px; box-shadow: 3px 3px 0 rgba(51,48,42,0.28);
    font-family: var(--font-hand);
  }
  a.btn:hover { transform: translate(-1px, -1px) rotate(-0.8deg); }
  footer { margin-top: 20px; font-size: 12px; color: var(--ink-soft); }
</style>
</head>
<body>
<main class="card">
  <div class="code">${code}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a class="btn" href="/">返回主页</a>
</main>
</body>
</html>`;
}

export function renderNotFoundPage(): string {
	return shell("404", "404", "页面不存在或已被移除");
}

export function renderErrorPage(): string {
	return shell("500", "500", "服务开小差了，请稍后重试");
}