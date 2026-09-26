import { useEffect, useState } from "react";
import { api, errorMessage, fmtDate, post } from "../../api";
import { useT } from "../../i18n";
import { Button, Card, Field, PageHeader } from "../../ui";
import { useNotice } from "../../notice-ui";
import { validatePasswordChange } from "../../account";
import { isPasskeySupported, registerPasskey } from "../../webauthn";

interface AccountUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
	twoFactorEnabled?: boolean;
}

/** Row of GET /passkey/list-user-passkeys — only `id` is guaranteed. */
interface PasskeyRow {
	id: string;
	name?: string | null;
	deviceType?: string;
	backedUp?: boolean;
	createdAt?: string | number;
}

export function Account(props: { user: AccountUser }) {
	const t = useT();
	const [twoFactorEnabled, setTwoFactorEnabled] = useState(props.user.twoFactorEnabled ?? false);
	return (
		<>
			<PageHeader
				title={t("Account")}
				subtitle={t("Your profile and sign-in credentials.")}
				crumbs={[{ label: t("Account") }]}
			/>
			<ProfileCard user={props.user} />
			<PasswordCard />
			<TwoFactorCard enabled={twoFactorEnabled} onChange={setTwoFactorEnabled} />
			<PasskeysCard />
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

function TwoFactorCard(props: { enabled: boolean; onChange: (enabled: boolean) => void }) {
	const t = useT();
	const notice = useNotice();
	const [mode, setMode] = useState<"idle" | "setup">("idle");
	const [password, setPassword] = useState("");
	const [totpURI, setTotpURI] = useState("");
	const [backupCodes, setBackupCodes] = useState<string[]>([]);
	const [code, setCode] = useState("");
	const [pending, setPending] = useState(false);

	function reset() {
		setMode("idle");
		setPassword("");
		setTotpURI("");
		setBackupCodes([]);
		setCode("");
	}

	async function begin() {
		setPending(true);
		try {
			const result = await post<{ totpURI: string; backupCodes?: string[] }>("/api/auth/two-factor/enable", password ? { password } : {});
			setTotpURI(result.totpURI);
			setBackupCodes(result.backupCodes ?? []);
			setMode("setup");
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	async function activate() {
		setPending(true);
		try {
			// Rotates the session server-side; the new cookie lands via Set-Cookie.
			await post("/api/auth/two-factor/verify-totp", { code: code.trim() });
			props.onChange(true);
			notice.toast("success", t("Two-factor enabled."));
			reset();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	async function regenerate() {
		setPending(true);
		try {
			const result = await post<{ backupCodes?: string[] }>("/api/auth/two-factor/generate-backup-codes", password ? { password } : {});
			setBackupCodes(result.backupCodes ?? []);
			notice.toast("success", t("Backup codes regenerated."));
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	async function disable() {
		setPending(true);
		try {
			await post("/api/auth/two-factor/disable", { password });
			props.onChange(false);
			notice.toast("success", t("Two-factor disabled."));
			setPassword("");
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	function copyUri() {
		navigator.clipboard.writeText(totpURI).then(() => notice.toast("info", t("Copied"))).catch(() => undefined);
	}

	return (
		<Card title={t("Two-factor authentication")}>
			{props.enabled ? (
				<p className="muted">{t("Two-factor authentication is active on this account.")}</p>
			) : mode === "idle" ? (
				<p className="muted">{t("Add a second factor for sign-in with an authenticator app.")}</p>
			) : (
				<>
					<Field
						label={t("Authenticator URI")}
						hint={t("Scan this URI with your authenticator app, then enter a code to activate.")}
					>
						<input value={totpURI} readOnly onFocus={event => event.currentTarget.select()} />
					</Field>
					<div className="btn-row">
						<Button kind="ghost" onClick={copyUri}>{t("Copy")}</Button>
					</div>
					{backupCodes.length > 0 && (
						<>
							<p className="muted">{t("Save these single-use codes somewhere safe — they are shown only once.")}</p>
							<div className="backup-codes">
								{backupCodes.map(entry => <code key={entry}>{entry}</code>)}
							</div>
						</>
					)}
					<Field label={t("Authenticator code")}>
						<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} />
					</Field>
					<div className="btn-row">
						<Button kind="primary" busy={pending} disabled={!code.trim()} onClick={() => void activate()}>{t("Activate")}</Button>
						<Button kind="ghost" disabled={pending} onClick={reset}>{t("Cancel")}</Button>
					</div>
				</>
			)}
			{mode === "idle" && (
				<>
					<Field
						label={t("Password")}
						hint={t("Confirms this change for accounts with a password; GitHub-only accounts can leave it empty.")}
					>
						<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" />
					</Field>
					<div className="btn-row">
						{props.enabled ? (
							<>
								<Button kind="ghost" busy={pending} onClick={() => void regenerate()}>{t("Regenerate backup codes")}</Button>
								<Button kind="danger" busy={pending} onClick={() => void disable()}>{t("Disable")}</Button>
							</>
						) : (
							<Button kind="primary" busy={pending} onClick={() => void begin()}>{t("Begin setup")}</Button>
						)}
					</div>
				</>
			)}
		</Card>
	);
}

function PasskeysCard() {
	const t = useT();
	const notice = useNotice();
	const supported = isPasskeySupported();
	const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [pending, setPending] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");

	async function reload() {
		try {
			setPasskeys(await api<PasskeyRow[]>("/api/auth/passkey/list-user-passkeys"));
		} catch (cause) {
			setError(errorMessage(cause));
		}
	}

	useEffect(() => { void reload(); }, []);

	async function add() {
		setPending(true);
		try {
			await registerPasskey(name.trim() || undefined);
			notice.toast("success", t("Passkey added."));
			setName("");
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	async function rename(row: PasskeyRow) {
		setPending(true);
		try {
			await post("/api/auth/passkey/update-passkey", { id: row.id, name: editName.trim() });
			notice.toast("success", t("Passkey renamed."));
			setEditingId(null);
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	async function remove(row: PasskeyRow) {
		const confirmed = await notice.confirm({
			title: t("Remove this passkey?"),
			body: row.name || t("Passkey"),
			confirmLabel: t("Remove"),
		});
		if (!confirmed) return;
		setPending(true);
		try {
			await post("/api/auth/passkey/delete-passkey", { id: row.id });
			notice.toast("success", t("Passkey removed."));
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setPending(false);
		}
	}

	return (
		<Card title={t("Passkeys")}>
			<p className="muted">{t("Sign in with biometrics or a security key instead of a password.")}</p>
			{!supported && <p className="error-note">{t("This browser does not support passkeys.")}</p>}
			{error && <p className="error-note" role="alert">{error}</p>}
			{supported && passkeys !== null && passkeys.length === 0 && (
				<p className="muted">{t("No passkeys registered yet.")}</p>
			)}
			{passkeys !== null && passkeys.length > 0 && (
				<ul className="passkey-list">
					{passkeys.map(row => (
						<li key={row.id}>
							{editingId === row.id ? (
								<>
									<input
										autoFocus
										value={editName}
										onChange={event => setEditName(event.target.value)}
										aria-label={t("Name")}
									/>
									<span className="btn-row">
										<Button kind="primary" busy={pending} disabled={!editName.trim()} onClick={() => void rename(row)}>{t("Save")}</Button>
										<Button kind="ghost" disabled={pending} onClick={() => setEditingId(null)}>{t("Cancel")}</Button>
									</span>
								</>
							) : (
								<>
									<span className="passkey-name">{row.name || t("Passkey")}</span>
									<span className="muted">{row.createdAt !== undefined ? fmtDate(row.createdAt) : ""}</span>
									<span className="btn-row">
										<Button kind="ghost" disabled={pending} onClick={() => { setEditingId(row.id); setEditName(row.name ?? ""); }}>{t("Rename")}</Button>
										<Button kind="danger" busy={pending} onClick={() => void remove(row)}>{t("Remove")}</Button>
									</span>
								</>
							)}
						</li>
					))}
				</ul>
			)}
			{supported && (
				<div className="add-passkey-row">
					<Field label={t("Name (optional)")} hint={t("A label to recognize this passkey later.")}>
						<input value={name} onChange={event => setName(event.target.value)} placeholder="MacBook Touch ID" />
					</Field>
					<div className="btn-row">
						<Button kind="primary" busy={pending} onClick={() => void add()}>{t("Add passkey")}</Button>
					</div>
				</div>
			)}
		</Card>
	);
}
