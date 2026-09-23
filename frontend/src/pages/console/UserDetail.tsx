import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban } from "lucide-react";
import { api, errorMessage, post } from "../../api";
import { useT } from "../../i18n";
import { navigate } from "../../router";
import {
	Badge, Button, Card, EmptyState, ErrorState, Field, MonoId,
	PageHeader, SkeletonProfile, SkeletonTable, Table, When,
} from "../../ui";
import { Modal } from "../../dialog";
import { useNotice } from "../../notice-ui";

interface UserRow {
	id: string;
	name: string;
	email: string;
	emailVerified: number | null;
	banned: boolean | null;
	twoFactorEnabled: boolean | null;
	createdAt: number;
}

interface UserDetailData {
	user: UserRow;
	sessions: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: number; expiresAt: number }[];
	accounts: { id: string; providerId: string; accountId: string; createdAt: number }[];
}

/** Full-page user detail (route `/users/:id`) — the old modal, uncramped. */
export function UserDetail(props: { id: string }) {
	const t = useT();
	const notice = useNotice();
	const [detail, setDetail] = useState<UserDetailData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [banOpen, setBanOpen] = useState(false);
	const [banReason, setBanReason] = useState("");
	const [banBusy, setBanBusy] = useState(false);
	const [busy, setBusy] = useState(false);

	const reload = useCallback(() => {
		return api<UserDetailData>(`/api/v1/users/${props.id}`)
			.then(result => { setDetail(result); setError(null); })
			.catch(cause => setError(errorMessage(cause)));
	}, [props.id]);
	useEffect(() => {
		setDetail(null);
		void reload();
	}, [reload, attempt]);

	async function run(action: () => Promise<unknown>, successMessage: string) {
		setBusy(true);
		try {
			await action();
			notice.toast("success", successMessage);
			await reload();
		} catch (cause) {
			notice.toast("error", errorMessage(cause));
		} finally {
			setBusy(false);
		}
	}

	const user = detail?.user;
	return (
		<>
			<PageHeader
				title={user?.name ?? t("User detail")}
				subtitle={user?.email}
				crumbs={[{ label: t("Admin") }, { label: t("Users"), to: "/users" }, { label: user?.email ?? "…" }]}
				actions={user && <Button kind="ghost" onClick={() => navigate("/users")}><ArrowLeft size={14} strokeWidth={1.75} aria-hidden />{t("Back")}</Button>}
			/>
			{detail === null ? (error
				? <ErrorState message={error} onRetry={() => setAttempt(value => value + 1)} />
				// Skeleton mirrors the final three-card geometry: profile grid + two tables.
				: <>
					<Card title={t("Profile")}><SkeletonProfile /></Card>
					<Card title={t("Sessions")}><SkeletonTable rows={3} /></Card>
					<Card title={t("Linked accounts")}><SkeletonTable rows={2} /></Card>
				</>
			) : (
				<>
					<Card title={t("Profile")}>
						<div className="profile-grid">
							<div>
								<span className="muted">{t("Email")}</span>
								<strong>{user?.email}</strong>
							</div>
							<div>
								<span className="muted">{t("User ID")}</span>
								<MonoId value={user?.id ?? ""} />
							</div>
							<div>
								<span className="muted">{t("Created")}</span>
								<strong><When value={user?.createdAt} /></strong>
							</div>
							<div>
								<span className="muted">{t("Status")}</span>
								<span className="status-badges">
									{user?.banned
										? <Badge tone="bad">{t("suspended")}</Badge>
										: <Badge tone="ok">{t("active")}</Badge>}
									{user?.emailVerified ? <Badge tone="ok">{t("Verified")}</Badge> : <Badge tone="warn">{t("no")}</Badge>}
									{user?.twoFactorEnabled ? <Badge>{t("2FA")}</Badge> : null}
								</span>
							</div>
						</div>
						<div className="btn-row" style={{ marginTop: 16 }}>
							{user?.banned ? (
								<Button kind="ghost" disabled={busy} onClick={() => void run(() => post(`/api/v1/users/${user.id}/unban`), t("User unsuspended."))}>{t("Unsuspend")}</Button>
							) : (
								<Button kind="danger" disabled={busy} onClick={() => { setBanReason(""); setBanOpen(true); }}><Ban size={14} strokeWidth={1.75} aria-hidden />{t("Suspend")}</Button>
							)}
						</div>
						{user?.banned && <p className="cell-sub" style={{ marginTop: 10 }}>{t("Ban and revoke everything this user controls.")}</p>}
					</Card>
					<Card title={t("Sessions")}>
						{detail.sessions.length === 0 ? <EmptyState art="users" title={t("None.")} /> : (
							<Table caption={t("Sessions")} head={[t("Created"), "IP", t("User agent"), t("Expires")]}>
								{detail.sessions.map(session => (
									<tr key={session.id}>
										<td className="muted"><When value={session.createdAt} /></td>
										<td><MonoId value={session.ipAddress ?? "—"} mask={false} /></td>
										<td className="muted"><span title={session.userAgent ?? ""}>{(session.userAgent ?? "").slice(0, 60)}</span></td>
										<td className="muted"><When value={session.expiresAt} /></td>
									</tr>
								))}
							</Table>
						)}
					</Card>
					<Card title={t("Linked accounts")}>
						{detail.accounts.length === 0 ? <EmptyState art="audit" title={t("None.")} /> : (
							<Table caption={t("Linked accounts")} head={[t("Provider"), t("Account ID"), t("Linked")]}>
								{detail.accounts.map(account => (
									<tr key={account.id}>
										<td><code>{account.providerId}</code></td>
										<td><MonoId value={account.accountId} /></td>
										<td className="muted"><When value={account.createdAt} /></td>
									</tr>
								))}
							</Table>
						)}
					</Card>
				</>
			)}
			{banOpen && user && (
				<Modal title={t("Suspend user")} open onClose={() => setBanOpen(false)}>
					<p className="confirm-body">{t("Suspending revokes this user's agents, delegations, clients and keys.")}</p>
					<Field label={t("Suspension reason?")}>
						<input value={banReason} onChange={event => setBanReason(event.target.value)} maxLength={200} />
					</Field>
					<div className="btn-row">
						<Button
							kind="danger-solid"
							busy={banBusy}
							disabled={!banReason.trim()}
							onClick={() => {
								setBanBusy(true);
								void run(async () => {
									await post(`/api/v1/users/${user.id}/ban`, { reason: banReason.trim() });
								}, t("User suspended.")).finally(() => {
									setBanBusy(false);
									setBanOpen(false);
								});
							}}
						>{t("Suspend")}</Button>
						<Button kind="ghost" disabled={banBusy} onClick={() => setBanOpen(false)}>{t("Cancel")}</Button>
					</div>
				</Modal>
			)}
		</>
	);
}
