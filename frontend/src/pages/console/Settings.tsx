import { useEffect, useState } from "react";
import { api, errorMessage, patch } from "../../api";
import { useT } from "../../i18n";
import { Card, CopyButton, ErrorState, PageHeader, SkeletonStats } from "../../ui";
import { useNotice } from "../../notice-ui";

interface SettingsResponse {
	registrationEnabled: boolean;
	dcrEnabled: boolean;
	issuer: string;
}

export function Settings() {
	const t = useT();
	const notice = useNotice();
	const [data, setData] = useState<SettingsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [busy, setBusy] = useState(false);

	const reload = () => api<SettingsResponse>("/api/v1/settings")
		.then(result => { setData(result); setError(null); })
		.catch(cause => setError(errorMessage(cause)));
	useEffect(() => {
		void reload();
	}, [attempt]);

	async function toggle(key: "registrationEnabled" | "dcrEnabled", value: boolean) {
		setBusy(true);
		try {
			await patch("/api/v1/settings", { [key]: value });
			notice.toast("success", t("Settings saved."));
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setBusy(false);
		}
	}

	if (error && !data) return <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />;
	if (!data) return <><PageHeader title={t("Platform settings")} crumbs={[{ label: t("Admin") }, { label: t("Settings") }]} /><SkeletonStats count={2} /></>;
	return (
		<>
			<PageHeader
				title={t("Platform settings")}
				crumbs={[{ label: t("Admin") }, { label: t("Settings") }]}
				subtitle={<>{t("Issuer:")} <code>{data.issuer}</code> <CopyButton value={data.issuer} /></>}
			/>
			<div className="inner-cap">
				<Card title={t("Registration")}>
					<label className="check-row">
						<input type="checkbox" disabled={busy} checked={data.registrationEnabled} onChange={event => void toggle("registrationEnabled", event.target.checked)} />
						{t("Allow new users to sign up (GitHub). Allowlisted admins can always sign in.")}
					</label>
				</Card>
				<Card title={t("Dynamic client registration")}>
					<label className="check-row">
						<input type="checkbox" disabled={busy} checked={data.dcrEnabled} onChange={event => void toggle("dcrEnabled", event.target.checked)} />
						{t("Allow unauthenticated OAuth clients to self-register (RFC 7591) — required for MCP client auto-discovery.")}
					</label>
				</Card>
			</div>
		</>
	);
}
