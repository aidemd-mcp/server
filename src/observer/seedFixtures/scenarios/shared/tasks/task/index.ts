import type { BoardColumnId } from "@/service/observer/kanban/types/index.js";
import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";

/** One board task from named fields, so a call site reads as the task it describes. */
export default function task({
	column,
	title,
	slug,
	priority,
	type,
}: {
	column: BoardColumnId;
	title: string;
	slug: string;
	priority: FixtureTask["priority"];
	type: string;
}): FixtureTask {
	return { column, slug, title, priority, type };
}
