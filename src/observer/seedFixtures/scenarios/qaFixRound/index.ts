import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import KANBAN_TAG from "@/observer/seedFixtures/scenarios/shared/kanbanTag/index.js";
import moduleFiles from "@/observer/seedFixtures/scenarios/shared/modules/index.js";
import pastSessions from "@/observer/seedFixtures/scenarios/shared/pastSessions/index.js";
import sessionRecord from "@/observer/seedFixtures/scenarios/shared/sessionRecord/index.js";
import boardTasks from "@/observer/seedFixtures/scenarios/shared/tasks/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/** How long the handoff says the second Fix round has run: `Round 2 · 1m 05s`; 65 s, in minutes. */
const FIX_RUNNING_FOR_MIN = 65 / 60;

/** `s-qa-fix`: QA found issues twice; Fix round 2 is running, plan completed 9/9, todo 2 of 5 open. */
export default function qaFixRound(): FixtureScenario {
	return {
		id: "qaFixRound",
		label: "s-qa-fix",
		project: {
			folderName: "docs-portal",
			installed: true,
			files: {
				...moduleFiles({
					large: false,
					score: {
						plan: { status: "completed", done: 9, total: 9 },
						todo: { status: "proposed", open: 2, total: 5 },
					},
				}),
				".aide/session.aide": sessionRecord({ variant: "qaFix" }),
			},
			board: { kanbanTag: KANBAN_TAG, tasks: boardTasks({ large: false }) },
			reportRoot: true,
			sessions: [
				{ pid: "live", events: timeline({ through: "fix", lastAgoMin: FIX_RUNNING_FOR_MIN }) },
				...pastSessions(),
			],
		},
	};
}
