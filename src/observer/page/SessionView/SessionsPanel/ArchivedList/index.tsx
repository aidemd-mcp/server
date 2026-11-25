import { useState } from "react";
import fetchArchived from "@/observer/page/api/fetchArchived/index.js";
import SessionRow from "@/observer/page/shared/SessionRow/index.js";
import useFetched from "@/observer/page/shared/useFetched/index.js";
import type { DeleteConfirm } from "@/observer/page/types/index.js";
import buildSessionRows from "@/observer/page/SessionView/buildSessionRows/index.js";
import removeSession from "@/observer/page/SessionView/removeSession/index.js";
import restoreFromArchive from "@/observer/page/SessionView/restoreFromArchive/index.js";

/**
 * The project's archived sessions, newest first, under the Sessions tab's `Show archived` toggle.
 * They are read from the observer when the list first shows and again whenever `version` changes
 * (an archive from the main list, a restore or a delete here), since the stream does not carry them.
 * Each row offers `Restore` and `Delete permanently`, the latter behind the same confirmation the
 * delete always had; `onChanged` tells the panel to refresh after either succeeds.
 */
export default function ArchivedList({
	now,
	token,
	projectKey,
	version,
	onChanged,
}: {
	now: Date;
	token: string;
	projectKey: string;
	version: number;
	onChanged(): void;
}) {
	const [confirm, setConfirm] = useState<DeleteConfirm>({ sessionId: null, error: null });
	const [restoreError, setRestoreError] = useState<{ sessionId: string; message: string } | null>(null);
	const archived = useFetched({ key: `${projectKey}:${version}`, load: () => fetchArchived({ token, projectKey }) });

	if (archived.state === "loading") return <p className="s-empty">Loading archived sessions…</p>;
	if (archived.state === "error") return <p className="s-empty">{archived.message}</p>;

	const rows = buildSessionRows({ listings: archived.data.sessions, held: [] });
	if (rows.length === 0) return <p className="s-empty">No archived sessions.</p>;

	return (
		<div className="av-list">
			{rows.map((row) => (
				<SessionRow
					key={row.sessionId}
					row={row}
					now={now}
					archived
					actionError={restoreError?.sessionId === row.sessionId ? restoreError.message : null}
					confirming={confirm.sessionId === row.sessionId}
					error={confirm.sessionId === row.sessionId ? confirm.error : null}
					onRestore={async () => {
						const message = await restoreFromArchive({ token, projectKey, sessionId: row.sessionId });
						setRestoreError(message === null ? null : { sessionId: row.sessionId, message });
						if (message === null) onChanged();
					}}
					onAskDelete={() => setConfirm({ sessionId: row.sessionId, error: null })}
					onCancel={() => setConfirm({ sessionId: null, error: null })}
					onDelete={async () => {
						const message = await removeSession({ token, projectKey, sessionId: row.sessionId });
						setConfirm(message === null ? { sessionId: null, error: null } : { sessionId: row.sessionId, error: message });
						if (message === null) onChanged();
					}}
				/>
			))}
		</div>
	);
}
