import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import KANBAN_TAG from "@/observer/seedFixtures/scenarios/shared/kanbanTag/index.js";
import lastEventAgoMin from "@/observer/seedFixtures/scenarios/shared/lastEventAgoMin/index.js";
import moduleFiles from "@/observer/seedFixtures/scenarios/shared/modules/index.js";
import sessionRecord from "@/observer/seedFixtures/scenarios/shared/sessionRecord/index.js";
import boardTasks from "@/observer/seedFixtures/scenarios/shared/tasks/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/**
 * `s-no-events`: installed, nothing in flight. The handoff draws only the root spec in the tree, so only the
 * root's `.aide/` files are written. The observer cannot list a project with no session, so the closest honest
 * state is one live session that has recorded its start and its prompt (brief #66 (d)); no phase has begun.
 */
export default function noEvents(): FixtureScenario {
	const files = moduleFiles({ large: false, score: { plan: null, todo: null } });
	const rootFiles = Object.fromEntries(Object.entries(files).filter(([path]) => path.startsWith(".aide/")));

	return {
		id: "noEvents",
		label: "s-no-events",
		project: {
			folderName: "aidemd-mcp",
			installed: true,
			files: { ...rootFiles, ".aide/session.aide": sessionRecord({ variant: "noEvents" }) },
			board: { kanbanTag: KANBAN_TAG, tasks: boardTasks({ large: false }) },
			reportRoot: true,
			sessions: [{ pid: "live", events: timeline({ through: "none", lastAgoMin: lastEventAgoMin }) }],
		},
	};
}
