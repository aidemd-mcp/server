import { useState } from "react";
import type { BoardColumnId } from "@/types/index.js";
import type { DrawerItem, SessionModel, SessionTab } from "@/observer/page/types/index.js";
import BoardPanel from "@/observer/page/SessionView/BoardPanel/index.js";
import toggleColumn from "@/observer/page/SessionView/BoardPanel/toggleColumn/index.js";
import PlansTable from "@/observer/page/SessionView/PlansTable/index.js";
import ProjectInfo from "@/observer/page/SessionView/ProjectInfo/index.js";
import RecordView from "@/observer/page/SessionView/RecordView/index.js";
import SessionsPanel from "@/observer/page/SessionView/SessionsPanel/index.js";
import TreePanel from "@/observer/page/SessionView/TreePanel/index.js";
import useTreeView from "./useTreeView/index.js";

/**
 * The one tab panel of the session view: the selected tab's content under the strip, labelled by
 * that tab. The History tab (phone only) has no content here, since the history column is the
 * page's own region and the stylesheet swaps the two. It holds the tree tab's filter, toggles
 * and folding and the board's expanded columns, so
 * they survive a switch to another tab and back (the handoff keeps them in the one viewer state).
 */
export default function TabPanel({
	tab,
	model,
	now,
	token,
	projectKey,
	routeSessionId,
	onOpen,
}: {
	tab: SessionTab;
	model: SessionModel;
	now: Date;
	token: string;
	projectKey: string;
	routeSessionId: string;
	onOpen(item: DrawerItem): void;
}) {
	const [treeView, setTreeView] = useTreeView({ tree: model.tree });
	const [expanded, setExpanded] = useState<ReadonlySet<BoardColumnId>>(() => new Set());
	return (
		<div className="av-panel" role="tabpanel" id="session-panel" aria-labelledby={`tab-${tab}`}>
			{tab === "tree" && <TreePanel tree={model.tree} view={treeView} onChange={setTreeView} onOpen={onOpen} />}
			{tab === "plans" && <PlansTable rows={model.plans} onOpen={onOpen} />}
			{tab === "board" && <BoardPanel board={model.board} expanded={expanded} onToggle={(column) => setExpanded((previous) => toggleColumn({ expanded: previous, column }))} onOpen={onOpen} />}
			{tab === "record" && <RecordView record={model.record} />}
			{tab === "sessions" && <ProjectInfo rootPath={model.header.rootPath} kanbanTag={model.header.kanbanTag} />}
			{tab === "sessions" && <SessionsPanel rows={model.sessions} now={now} token={token} projectKey={projectKey} routeSessionId={routeSessionId} />}
		</div>
	);
}
