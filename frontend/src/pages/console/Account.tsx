import { useState } from "react";
import { errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { Button, Card, Field, PageHeader } from "../../ui";
import { useNotice } from "../../notice-ui";
import { validatePasswordChange } from "../../account";

interface AccountUser {
	name: string;
	email: string;
}

export function Account(props: { user: AccountUser }) {
	const t = useT();
	return (
		<>
			<PageHeader
				title={t("Account")}
				subtitle={t("Your profile and sign-in credentials.")}
				crumbs={[{ label: t("Account") }]}
			/>
			<ProfileCard user={props.user} />
			<PasswordCard />
		</>
	);
}

function ProfileCard(props: { user: AccountUser }) {
	const t = useT();
	const notice = useNotice();
	const [name, setName] = useState(props.user.name);
	const [pending, setPending] = useState(false);

	async function save() {
		setPending(true);
		try {
			await post("/api/auth/update-user", { name: name.trim() });
			notice.toast("success", t("Profile updated."));
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<Field label={t("Display name")} hint={t("Shown in the console and on consent screens.")}>
				<input value={name} onChange={event => setName(event.target.value)} />
			</Field>
			<Field label={t("Email")} hint={t("Sign-in identity — managed by your sign-in provider.")}>
				<input value={props.user.email} readOnly disabled />
			</Field>
			<div className="btn-row">
				<Button kind="primary" busy={pending} disabled={!name.trim() || name.trim() === props.user.name} onClick={() => void save()}>{t("Save")}</Button>
			</div>
		</Card>
	);
}

function PasswordCard() {
	const t = useT();
	const notice = useNotice();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [revokeOthers, setRevokeOthers] = useState(true);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save() {
		const invalid = validatePasswordChange(newPassword, confirm);
		if (invalid) {
			setError(invalid === "short" ? t("New password must be at least 8 characters.") : t("Passwords do not match."));
			return;
		}
		setError(null);
		setPending(true);
		try {
			await post("/api/auth/change-password", { currentPassword, newPassword, revokeOtherSessions: revokeOthers });
			notice.toast("success", t("Password updated."));
			setCurrentPassword("");
			setNewPassword("");
			setConfirm("");
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card>
			<Field label={t("Current password")}>
				<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" />
			</Field>
			<Field label={t("New password")} error={error}>
				<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" />
			</Field>
			<Field label={t("Confirm new password")}>
				<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" />
			</Field>
			<label className="check-row">
				<input type="checkbox" checked={revokeOthers} onChange={event => setRevokeOthers(event.target.checked)} />
				{t("Sign out other sessions")}
			</label>
			<p className="muted">{t("Password changes apply to accounts with a password credential; GitHub-only accounts keep using GitHub to sign in.")}</p>
			<div className="btn-row">
				<Button kind="primary" busy={pending} disabled={!currentPassword || !newPassword || !confirm} onClick={() => void save()}>{t("Change password")}</Button>
			</div>
		</Card>
	);
}
