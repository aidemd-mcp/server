import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";
import handoffTasks from "@/observer/seedFixtures/scenarios/shared/handoffTasks/index.js";
import fillerTasks from "@/observer/seedFixtures/scenarios/shared/tasks/fillerTasks/index.js";
import task from "@/observer/seedFixtures/scenarios/shared/tasks/task/index.js";

/** The handoff's five Done tasks, newest first (`boardData`). */
const NEWEST_DONE: FixtureTask[] = [
	task({ column: "done", ...handoffTasks.planSubsteps, priority: "p2", type: "bug" }),
	task({ column: "done", title: "Events carry the brain folder on session start", slug: "event-brain-folder", priority: "p2", type: "change" }),
	task({ column: "done", title: "QA verdict event includes open count", slug: "qa-open-count", priority: "p2", type: "change" }),
	task({ column: "done", title: "Release event on version tag", slug: "release-event", priority: "p3", type: "feature" }),
	task({ column: "done", title: "Tidy CLI help text", slug: "cli-help-tidy", priority: "p3", type: "housekeeping" }),
];

/** The Done column's `count` tasks (the handoff's 14, or 128 when large): its five named ones, then older filler. */
export default function doneTasks(count: number): FixtureTask[] {
	return [...NEWEST_DONE, ...fillerTasks({ column: "done", label: "Earlier", first: 1, count: count - NEWEST_DONE.length })];
}
