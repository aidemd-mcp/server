import type { FixtureProject } from "@/observer/seedFixtures/types/index.js";
import KANBAN_TAG from "@/observer/seedFixtures/scenarios/shared/kanbanTag/index.js";
import lastEventAgoMin from "@/observer/seedFixtures/scenarios/shared/lastEventAgoMin/index.js";
import moduleFiles from "@/observer/seedFixtures/scenarios/shared/modules/index.js";
import pastSessions from "@/observer/seedFixtures/scenarios/shared/pastSessions/index.js";
import sessionRecord from "@/observer/seedFixtures/scenarios/shared/sessionRecord/index.js";
import boardTasks from "@/observer/seedFixtures/scenarios/shared/tasks/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/**
 * The project of handoff scenario `s-building` (live, Build step 4 of 9), which `s-two-live`, `s-board-error`
 * and `s-large` start from: the handoff's modules with `src/tools/score`'s plan approved and 3 of 9 steps
 * checked, its board, one live session whose history ends on the commit of step 3, and the three ended
 * sessions. `large` adds the extra modules and tasks; `brain: "missing"` reports a brain folder that does
 * not exist.
 */
export default function buildingProject({
	large,
	brain,
}: {
	large: boolean;
	brain: "present" | "missing";
}): FixtureProject {
	return {
		folderName: "aidemd-mcp",
		installed: true,
		files: {
			...moduleFiles({ large, score: { plan: { status: "approved", done: 3, total: 9 }, todo: null } }),
			".aide/session.aide": sessionRecord({ variant: "building" }),
		},
		board:
			brain === "missing"
				? { kanbanTag: KANBAN_TAG, missingBrain: true }
				: { kanbanTag: KANBAN_TAG, tasks: boardTasks({ large }) },
		reportRoot: true,
		sessions: [{ pid: "live", events: timeline({ through: "build", lastAgoMin: lastEventAgoMin }) }, ...pastSessions()],
	};
}
