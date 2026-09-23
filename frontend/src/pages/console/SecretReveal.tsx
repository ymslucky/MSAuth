import { useT } from "../../i18n";
import { Button, CopyButton } from "../../ui";
import { Modal } from "../../dialog";

/** One-time secret reveal: dashed box + copy affordance + Done. Shared by the
    application-secret rotation and new-API-key flows. */
export function SecretReveal(props: { title: string; secret: string; onDone: () => void }) {
	const t = useT();
	return (
		<Modal title={props.title} open onClose={props.onDone}>
			<p className="muted">{t("Copy it now — this value is never shown again.")}</p>
			<code className="secret-box">{props.secret}</code>
			<div className="btn-row">
				<CopyButton value={props.secret} />
				<Button kind="primary" onClick={props.onDone}>{t("Done")}</Button>
			</div>
		</Modal>
	);
}
