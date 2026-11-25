import { useState } from "react";
import SessionRow from "@/observer/page/shared/SessionRow/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import sendToArchive from "@/observer/page/SessionView/sendToArchive/index.js";
import ArchivedList from "./ArchivedList/index.js";

/**
 * The Sessions tab: every session of the project, newest first, each a `SessionRow`. An ended row
 * offers `Archive`, which acts at once through `sendToArchive` (a failure's message shows under that
 * row, and a success leaves the row's removal to the stream's frames). Under the list, `Show
 * archived` opens the project's archived sessions, each with `Restore` and `Delete permanently`
 * (`ArchivedList`). The archived list owns its own delete confirmation. `routeSessionId` is the session the page is on, so archiving it
 * leaves for Home.
 */
export default function SessionsPanel({
	rows,
	now,
	token,
	projectKey,
	routeSessionId,
}: {
	rows: SessionRowModel[];
	now: Date;
	token: string;
	projectKey: string;
	routeSessionId: string;
}) {
	const [showArchived, setShowArchived] = useState(false);
	const [version, setVersion] = useState(0);
	const [failed, setFailed] = useState<{ sessionId: string; message: string } | null>(null);

	return (
		<>
			<div className="av-list">
				{rows.map((row) => (
					<SessionRow
						key={row.sessionId}
						row={row}
						now={now}
						actionError={failed?.sessionId === row.sessionId ? failed.message : null}
						onArchive={async () => {
							const message = await sendToArchive({ token, projectKey, sessionId: row.sessionId, routeSessionId });
							setFailed(message === null ? null : { sessionId: row.sessionId, message });
							if (message === null) setVersion((previous) => previous + 1);
						}}
					/>
				))}
			</div>
			<div className="av-archived">
				<div className="av-archived-bar">
					<button type="button" className="av-btn" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>
						{showArchived ? "Hide archived" : "Show archived"}
					</button>
				</div>
				{showArchived && (
					<ArchivedList
						now={now}
						token={token}
						projectKey={projectKey}
						version={version}
						onChanged={() => setVersion((previous) => previous + 1)}
					/>
				)}
			</div>
		</>
	);
}
