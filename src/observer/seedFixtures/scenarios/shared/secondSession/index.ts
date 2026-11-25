import { SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";
import type { FixtureSession } from "@/observer/seedFixtures/types/index.js";
import handoffTasks from "@/observer/seedFixtures/scenarios/shared/handoffTasks/index.js";

/**
 * The handoff's second live session (`s-two-live`, started 15:30): it picked `aide-validate-path-scope`,
 * finished Spec in 1m 40s and has been in Research on `src/tools/validate` for 1m 52s. Ages are measured
 * back from now, so the running Research reads `1m 52s` whenever the fixture is seen right after seeding.
 */
export default function secondSession(): FixtureSession {
	const ago = (seconds: number) => seconds / SECONDS_PER_MINUTE;

	return {
		pid: "live",
		presence: { state: "working", minutesAgo: ago(112) },
		events: [
			{ offsetMin: ago(232), kind: "session_started" },
			{
				offsetMin: ago(226),
				kind: "task",
				...handoffTasks.validate,
				action: "picked",
				column: "In Progress",
			},
			{ offsetMin: ago(220), kind: "pipeline_started", pipeline: handoffTasks.validate.slug, phase: "spec" },
			{ offsetMin: ago(214), kind: "phase_started", pipeline: handoffTasks.validate.slug, phase: "spec", agent: "aide-spec-writer", module: "src/tools/validate" },
			{ offsetMin: ago(114), kind: "phase_finished", pipeline: handoffTasks.validate.slug, phase: "spec", agent: "aide-spec-writer", module: "src/tools/validate" },
			{ offsetMin: ago(112), kind: "phase_started", pipeline: handoffTasks.validate.slug, phase: "research", agent: "aide-domain-expert", module: "src/tools/validate" },
		],
	};
}
