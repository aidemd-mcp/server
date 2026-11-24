import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import KANBAN_TAG from "@/observer/seedFixtures/scenarios/shared/kanbanTag/index.js";
import moduleFiles from "@/observer/seedFixtures/scenarios/shared/modules/index.js";
import pastSessions from "@/observer/seedFixtures/scenarios/shared/pastSessions/index.js";
import sessionRecord from "@/observer/seedFixtures/scenarios/shared/sessionRecord/index.js";
import boardTasks from "@/observer/seedFixtures/scenarios/shared/tasks/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/**
 * How long ago the last event happened: the observer reports `idle` for a live pid whose last event is
 * over 30 minutes old (brief #23), so the handoff's 12 minutes cannot be idle (brief #66 (c)).
 */
const LAST_EVENT_AGO_MIN = 40;

/** `s-idle`: the whole pipeline ran and shipped; plan completed 9/9, todo 5/5 closed, QA passed, release v0.9.2. */
export default function idle(): FixtureScenario {
	return {
		id: "idle",
		label: "s-idle",
		project: {
			folderName: "aidemd-mcp",
			installed: true,
			files: {
				...moduleFiles({
					large: false,
					score: {
						plan: { status: "completed", done: 9, total: 9 },
						todo: { status: "completed", open: 0, total: 5 },
					},
				}),
				".aide/session.aide": sessionRecord({ variant: "idle" }),
			},
			board: { kanbanTag: KANBAN_TAG, tasks: boardTasks({ large: false }) },
			reportRoot: true,
			sessions: [
				{ pid: "live", events: timeline({ through: "idle", lastAgoMin: LAST_EVENT_AGO_MIN }) },
				...pastSessions(),
			],
		},
	};
}
