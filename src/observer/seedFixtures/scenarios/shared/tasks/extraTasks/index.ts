import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";
import fillerTasks from "@/observer/seedFixtures/scenarios/shared/tasks/fillerTasks/index.js";
import task from "@/observer/seedFixtures/scenarios/shared/tasks/task/index.js";

const EXTRA_TITLES = [
	"Cache parsed specs between tool calls",
	"Graph view of module dependencies",
	"Export specs as one markdown file",
	"Diff specs since a commit",
	"Retro digest across closed todos",
	"Lock file for concurrent session writers",
	"Configurable phase names",
	"Watcher debounce for large trees",
];

const EXTRA_TYPES = ["feature", "change", "test", "housekeeping"];

/** The handoff's slug rule for these titles: lowercased, runs of other characters one hyphen, cut at 28 characters. */
function extraSlug(title: string): string {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28);
}

/**
 * The `large` board's extra tasks (`boardData` with `large`): eight more Backlog tasks and two more Todo ones,
 * then filler so Backlog holds 41 and Todo 22 as the handoff's column totals say (its base Backlog has 4
 * tasks and its base Todo 3).
 */
export default function extraTasks(): FixtureTask[] {
	const backlog = EXTRA_TITLES.map((title, index) =>
		task({
			column: "backlog",
			title,
			slug: extraSlug(title),
			priority: (["p2", "p3"] as const)[index % 2],
			type: EXTRA_TYPES[index % EXTRA_TYPES.length],
		}),
	);
	const todo = [
		task({ column: "todo", title: "Score ties break by path", slug: "score-tie-break", priority: "p3", type: "change" }),
		task({ column: "todo", title: "Viewer shows release events", slug: "viewer-release-row", priority: "p2", type: "feature" }),
	];

	return [
		...backlog,
		...fillerTasks({ column: "backlog", label: "Backlog", first: 1, count: 41 - 4 - backlog.length }),
		...todo,
		...fillerTasks({ column: "todo", label: "Todo", first: 1, count: 22 - 3 - todo.length }),
	];
}
