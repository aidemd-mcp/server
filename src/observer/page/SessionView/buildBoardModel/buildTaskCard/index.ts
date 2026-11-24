import type { BoardTask } from "@/types/index.js";
import type { TaskCardModel } from "@/observer/page/types/index.js";

/**
 * One task as its card: a readable note gives its title, priority and type; an unreadable one keeps
 * its slug as the title and carries the observer's reason, which the card shows in place of
 * priority and type. `linked` is the session record's naming or a `task` event of the focused session.
 */
export default function buildTaskCard({ task, linked }: { task: BoardTask; linked: boolean }): TaskCardModel {
	if (task.state === "unreadable") {
		return { slug: task.slug, title: task.slug, priority: null, type: null, linked, unreadable: task.reason };
	}
	return { slug: task.slug, title: task.title, priority: task.priority, type: task.type ?? null, linked, unreadable: null };
}
