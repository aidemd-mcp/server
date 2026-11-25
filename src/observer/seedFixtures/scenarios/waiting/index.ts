import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import KANBAN_TAG from "@/observer/seedFixtures/scenarios/shared/kanbanTag/index.js";
import moduleFiles from "@/observer/seedFixtures/scenarios/shared/modules/index.js";
import pastSessions from "@/observer/seedFixtures/scenarios/shared/pastSessions/index.js";
import sessionRecord from "@/observer/seedFixtures/scenarios/shared/sessionRecord/index.js";
import boardTasks from "@/observer/seedFixtures/scenarios/shared/tasks/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/** How long the handoff says the plan approval has been waiting: `Waiting · 2m`; 128 s, in minutes. */
const WAITING_FOR_MIN = 128 / 60;

/** `s-waiting`: live, waiting on the user to approve `src/tools/score/plan.aide`, which is still `proposed`. */
export default function waiting(): FixtureScenario {
	return {
		id: "waiting",
		label: "s-waiting",
		project: {
			folderName: "aidemd-site",
			installed: true,
			files: {
				...moduleFiles({ large: false, score: { plan: { status: "proposed", done: 0, total: 9 }, todo: null } }),
				".aide/session.aide": sessionRecord({ variant: "waiting" }),
			},
			board: { kanbanTag: KANBAN_TAG, tasks: boardTasks({ large: false }) },
			reportRoot: true,
			sessions: [
				{
					pid: "live",
					presence: { state: "waiting", minutesAgo: WAITING_FOR_MIN },
					events: timeline({ through: "wait", lastAgoMin: WAITING_FOR_MIN }),
				},
				...pastSessions(),
			],
		},
	};
}
