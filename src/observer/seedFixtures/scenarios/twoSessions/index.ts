import type { FixtureScenario } from "@/observer/seedFixtures/types/index.js";
import buildingProject from "@/observer/seedFixtures/scenarios/shared/buildingProject/index.js";
import secondSession from "@/observer/seedFixtures/scenarios/shared/secondSession/index.js";
import timeline from "@/observer/seedFixtures/scenarios/shared/timeline/index.js";

/** How long the handoff says Plan has run in the first session: `Running 3m 41s`; 221 s, in minutes. */
const PLAN_RUNNING_FOR_MIN = 221 / 60;

/**
 * `s-two-live`: the first session is in Plan on `src/tools/score`, and a second live session started later
 * is in Research on `src/tools/validate`. The files and board are the live build's, as the handoff's tree and
 * board are the same in every scenario.
 */
export default function twoSessions(): FixtureScenario {
	const project = buildingProject({ large: false, brain: "present" });
	const [, ...past] = project.sessions;

	return {
		id: "twoSessions",
		label: "s-two-live",
		project: {
			...project,
			sessions: [{ pid: "live", events: timeline({ through: "plan", lastAgoMin: PLAN_RUNNING_FOR_MIN }) }, secondSession(), ...past],
		},
	};
}
