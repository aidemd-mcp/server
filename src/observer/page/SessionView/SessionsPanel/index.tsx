import SessionRow from "@/observer/page/shared/SessionRow/index.js";
import type { DeleteConfirm, SessionRowModel } from "@/observer/page/types/index.js";
import removeSession from "@/observer/page/SessionView/removeSession/index.js";

/**
 * The Sessions tab: every session of the project, newest first, each a `SessionRow`. Delete exists
 * only on an ended row and asks first; confirming goes through `removeSession`, a failure's message
 * shows inside that row's confirmation, and a success leaves the row's removal to the stream's
 * frames. Which one row is confirming, and its failure message, are the caller's (`confirm`,
 * `onConfirmChange`), so an open confirmation survives a trip to another tab. `routeSessionId` is
 * the session the page is on, so deleting it leaves for Home.
 */
export default function SessionsPanel({
	rows,
	now,
	token,
	projectKey,
	routeSessionId,
	confirm,
	onConfirmChange,
}: {
	rows: SessionRowModel[];
	now: Date;
	token: string;
	projectKey: string;
	routeSessionId: string;
	confirm: DeleteConfirm;
	onConfirmChange(confirm: DeleteConfirm): void;
}) {
	return (
		<div className="av-list">
			{rows.map((row) => (
				<SessionRow
					key={row.sessionId}
					row={row}
					now={now}
					confirming={confirm.sessionId === row.sessionId}
					error={confirm.sessionId === row.sessionId ? confirm.error : null}
					onAskDelete={() => onConfirmChange({ sessionId: row.sessionId, error: null })}
					onCancel={() => onConfirmChange({ sessionId: null, error: null })}
					onDelete={async () => {
						const message = await removeSession({ token, projectKey, sessionId: row.sessionId, routeSessionId });
						onConfirmChange(message === null ? { sessionId: null, error: null } : { sessionId: row.sessionId, error: message });
					}}
				/>
			))}
		</div>
	);
}
