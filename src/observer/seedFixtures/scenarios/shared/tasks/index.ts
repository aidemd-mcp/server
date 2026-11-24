import { HOUR_MS } from "@/util/timeUnits/index.js";
import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";
import doneTasks from "./doneTasks/index.js";
import handoffTasks from "@/observer/seedFixtures/scenarios/shared/handoffTasks/index.js";
import extraTasks from "./extraTasks/index.js";
import RANK_TASK_NOTE from "./rankTaskNote/index.js";
import task from "./task/index.js";

/** The newest `updated` stamp of a column's first task; each later task is one hour older. */
const NEWEST_UPDATED_MS = Date.parse("2026-11-22T18:00:00.000Z");

/** Stamps `updated` on every task, newest first in each column's list order, so ordering by it is deterministic. */
function stampUpdated(tasks: FixtureTask[]): FixtureTask[] {
	const seen = new Map<string, number>();
	return tasks.map((entry) => {
		const position = seen.get(entry.column) ?? 0;
		seen.set(entry.column, position + 1);
		return { ...entry, updated: new Date(NEWEST_UPDATED_MS - position * HOUR_MS).toISOString() };
	});
}

/**
 * The handoff's board (`boardData`) as tasks: Backlog 4, Todo 3, In Progress 2, In Review 1 and Done 14 (its
 * five named tasks plus older ones), or when `large` the extra Backlog and Todo tasks (41 and 22 in all) and
 * 128 Done. `aide-score-misaligned-rank` is the task the pipeline works on and the only one with a note of its
 * own. Every task carries an `updated` stamp, newest first within its column, so Done's five most recent are
 * the handoff's five.
 */
export default function boardTasks({ large }: { large: boolean }): FixtureTask[] {
	const tasks: FixtureTask[] = [
		task({ column: "backlog", title: "Search across specs from the CLI", slug: "cli-spec-search", priority: "p3", type: "feature" }),
		task({ column: "backlog", title: "Remove legacy pipeline.json reader", slug: "remove-pipeline-json", priority: "p3", type: "housekeeping" }),
		task({ column: "backlog", title: "Golden tests for plan step parsing", slug: "golden-plan-steps", priority: "p2", type: "test" }),
		task({ column: "backlog", title: "Doctor command explains missing brain folder", slug: "doctor-brain-hint", priority: "p2", type: "change" }),
		task({ column: "todo", ...handoffTasks.validate, priority: "p1", type: "bug" }),
		task({ column: "todo", title: "Brain folder path with spaces breaks the event writer", slug: "brain-path-spaces", priority: "p0", type: "bug" }),
		task({ column: "todo", title: "init asks for the kanban tag", slug: "init-kanban-tag", priority: "p3", type: "feature" }),
		{
			...task({ column: "in-progress", ...handoffTasks.rank, priority: "p1", type: "bug" }),
			markdown: RANK_TASK_NOTE,
		},
		task({ column: "in-progress", ...handoffTasks.installRoot, priority: "p2", type: "feature" }),
		task({ column: "in-review", ...handoffTasks.reconnect, priority: "p1", type: "feature" }),
	];

	return stampUpdated([...tasks, ...(large ? extraTasks() : []), ...doneTasks(large ? 128 : 14)]);
}
