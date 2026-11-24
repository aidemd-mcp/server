import type { BoardColumnId } from "@/service/observer/kanban/types/index.js";
import type { FixtureTask } from "@/observer/seedFixtures/types/index.js";
import task from "@/observer/seedFixtures/scenarios/shared/tasks/task/index.js";
import TASK_TYPES from "@/observer/seedFixtures/scenarios/shared/tasks/taskTypes/index.js";

const FILLER_PRIORITIES: FixtureTask["priority"][] = ["p2", "p3", "p1", "p3"];

/**
 * The tasks a column holds beyond the ones the handoff names, so the column's total matches the handoff's
 * count (the prototype only draws the named ones and states the total). Numbered from `first`, titles and
 * slugs `<Column> task <n>`, priorities and types cycling.
 */
export default function fillerTasks({
	column,
	label,
	first,
	count,
}: {
	column: BoardColumnId;
	label: string;
	first: number;
	count: number;
}): FixtureTask[] {
	return Array.from({ length: count }, (_, index) => {
		const number = first + index;
		return task({
			column,
			title: `${label} task ${number}`,
			slug: `${column}-task-${number}`,
			priority: FILLER_PRIORITIES[index % FILLER_PRIORITIES.length],
			type: TASK_TYPES[index % TASK_TYPES.length],
		});
	});
}
