import { useEffect, useState } from "react";
import { api } from "./api";
import { usePath } from "./router";
import { resolveGate } from "./gate";
import Login from "./pages/Login";
import Consent from "./pages/Consent";
import Docs from "./pages/Docs";
import Console from "./pages/console/Console";

export default function App() {
	const path = usePath();
	const [authenticated, setAuthenticated] = useState<boolean | null>(null);
	useEffect(() => {
		let alive = true;
		api<{ user?: unknown } | null>("/api/auth/get-session")
			.then(session => { if (alive) setAuthenticated(Boolean(session && session.user)); })
			.catch(() => { if (alive) setAuthenticated(false); });
		return () => { alive = false; };
	}, []);
	const gate = resolveGate(path, authenticated === true);
	// Public docs render immediately — no splash, no dependency on the session probe.
	if (gate === "docs") return <Docs />;
	if (authenticated === null && gate !== "login") {
		return <div className="boot-splash" role="status" aria-label="Loading" />;
	}
	if (gate === "login") return <Login />;
	if (gate === "consent") return <Consent />;
	return <Console />;
}
