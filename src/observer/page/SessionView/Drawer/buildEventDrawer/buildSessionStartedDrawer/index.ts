import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { DrawerBlockModel, DrawerContext, DrawerModel } from "@/observer/page/types/index.js";

/** A session start's drawer: kind `Session started`, `Session HH:MM`, and what the session reported (project root, kanban tag, brain folder), each only when it did. */
export default function buildSessionStartedDrawer({
	event,
	context,
}: {
	event: Extract<ObserverEvent, { kind: "session_started" }>;
	context: DrawerContext;
}): DrawerModel {
	const reported = [
		{ key: "Project root", value: event.projectRoot },
		{ key: "Kanban tag", value: event.kanbanTag },
		{ key: "Brain folder", value: event.brainPath },
	].flatMap(({ key, value }) => (value === undefined ? [] : [{ key, value, mono: true }]));
	const blocks: DrawerBlockModel[] = reported.length === 0 ? [] : [{ heading: "Reported", icon: "power", badge: null, type: "kv", rows: reported }];
	return {
		kind: "Session started",
		title: `Session ${formatClock({ iso: event.ts, now: context.now }).clock}`,
		titleMono: false,
		meta: null,
		blocks,
	};
}
