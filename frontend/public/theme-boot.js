// Theme bootstrap — resolved BEFORE first paint (render-blocking <head> script,
// same-origin so it passes the worker's CSP `script-src 'self'`).
// Keep in sync with frontend/src/theme.ts (THEME_STORAGE_KEY, auto/light/dark).
(function () {
	var choice = "auto";
	try {
		var stored = localStorage.getItem("msauth-theme");
		if (stored === "light" || stored === "dark" || stored === "auto") choice = stored;
	} catch (e) {
		/* storage unavailable — follow the system */
	}
	var dark = choice === "dark" ||
		(choice === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
