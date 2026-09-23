import { usePath } from "./router";
import Login from "./pages/Login";
import Consent from "./pages/Consent";
import Console from "./pages/console/Console";

export default function App() {
	const path = usePath();
	if (path === "/login") return <Login />;
	if (path === "/consent") return <Consent />;
	return <Console />;
}
