import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n";
import { ThemeProvider } from "./theme";
import { NoticeProvider } from "./notice-ui";
import "./tokens.css";
import "./style.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ThemeProvider>
			<LangProvider>
				<NoticeProvider>
					<App />
				</NoticeProvider>
			</LangProvider>
		</ThemeProvider>
	</StrictMode>,
);
