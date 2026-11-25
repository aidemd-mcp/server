import BOARD_COLUMNS from "@/service/observer/kanban/shared/columns/index.js";
import type { DrawerBlockModel, DrawerModel, TaskNote } from "@/observer/page/types/index.js";
import buildTaskBlocks from "./buildTaskBlocks/index.js";

/**
 * A kanban task's drawer: kind `Task`, its title, its slug as the meta line and its column, priority
 * and type as chips, the note's sections as blocks, and a `Linked` block naming the session when this session
 * picked or moved it (`sessionStart` is that session's `Today 14:02`; `This session` when unknown).
 * An unreadable note shows the observer's reason as its one block.
 */
export default function buildTaskDrawer({ task, linked, sessionStart }: { task: TaskNote; linked: boolean; sessionStart: string | null }): DrawerModel {
	const column = BOARD_COLUMNS.find((candidate) => candidate.id === task.column)?.label ?? task.column;
	const blocks: DrawerBlockModel[] =
		task.task.state === "unreadable"
			? [{ heading: "Message", icon: "error", badge: null, type: "pre", text: task.task.reason }]
			: buildTaskBlocks({ markdown: task.markdown });
	if (linked) {
		blocks.push({
			heading: "Linked",
			icon: "eye",
			badge: null,
			type: "kv",
			rows: [{ key: "Session", value: sessionStart === null ? "This session" : `${sessionStart} (this session)`, mono: false }],
		});
	}
	return {
		kind: "Task",
		title: task.task.state === "readable" ? task.task.title : task.slug,
		titleMono: false,
		meta: task.slug,
		taskChips: {
			column,
			priority: task.task.state === "readable" ? task.task.priority : null,
			type: task.task.state === "readable" ? (task.task.type ?? null) : null,
		},
		blocks,
	};
}
