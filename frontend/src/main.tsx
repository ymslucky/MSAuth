import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n";
import { NoticeProvider } from "./ui";
import "./style.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<LangProvider>
			<NoticeProvider>
				<App />
			</NoticeProvider>
		</LangProvider>
	</StrictMode>,
);
