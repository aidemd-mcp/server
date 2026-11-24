import { useState } from "react";
import Icon from "@/observer/page/shared/Icon/index.js";
import InstallCommand from "@/observer/page/shared/InstallCommand/index.js";
import Notice from "@/observer/page/shared/Notice/index.js";
import type { DeleteConfirm, SessionRowModel } from "@/observer/page/types/index.js";
import SessionsPanel from "@/observer/page/SessionView/SessionsPanel/index.js";

/**
 * What a session view shows for a project whose reported folder holds no AIDE file: the calm
 * notice with the install command, then the project's sessions (the one list that still works from
 * events). It fills in by itself when the next phase starts. The block is the page's main region,
 * and it owns the sessions list's delete confirmation (there are no tabs here to switch away from).
 */
export default function NotInstalled({
	projectRoot,
	sessions,
	now,
	token,
	projectKey,
	routeSessionId,
}: {
	projectRoot: string;
	sessions: SessionRowModel[];
	now: Date;
	token: string;
	projectKey: string;
	routeSessionId: string;
}) {
	const [confirm, setConfirm] = useState<DeleteConfirm>({ sessionId: null, error: null });
	return (
		<main id="main" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32, maxWidth: 1100 }}>
			<Notice icon="folder" iconSize="xl" heading="AIDE isn't installed in this project yet">
				<p>
					This session reported <span className="mono">{projectRoot}</span>, but there&apos;s no <span className="mono">.aide/intent.aide</span>{" "}
					there, so there&apos;s no pipeline or intent tree to show. Run this in the project root:
				</p>
				<InstallCommand />
				<p style={{ marginTop: 12 }}>When the next phase starts, this page fills in by itself.</p>
			</Notice>
			<section className="av-sect" aria-labelledby="h-sessions">
				<h2 className="av-h2" id="h-sessions">
					<Icon name="sessions" />
					Sessions <span className="n">{sessions.length}</span>
				</h2>
				<SessionsPanel rows={sessions} now={now} token={token} projectKey={projectKey} routeSessionId={routeSessionId} confirm={confirm} onConfirmChange={setConfirm} />
			</section>
		</main>
	);
}
