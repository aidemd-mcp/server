import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import joinMeta from "@/observer/page/shared/joinMeta/index.js";
import type { DrawerContext, DrawerModel } from "@/observer/page/types/index.js";
import findRound from "@/observer/page/SessionView/buildHistoryModel/labelEvent/findRound/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import buildTodoBlocks from "@/observer/page/SessionView/Drawer/buildModuleDrawer/buildTodoBlocks/index.js";

/**
 * A QA verdict's drawer: kind `QA verdict`, `<n> issues open · round <r>` (`Issues open · round <r>`
 * when no count was reported) or `Passed`, `<module> · HH:MM`, and the module's todo issues when its
 * todo was read (`todoText`, null when the module lists none).
 */
export default function buildQaDrawer({
	event,
	context,
	todoText,
}: {
	event: Extract<ObserverEvent, { kind: "qa_verdict" }>;
	context: DrawerContext;
	todoText: string | null;
}): DrawerModel {
	const projectRoot = context.status?.projectRoot ?? "";
	const module = normalizeModule({ projectRoot, module: event.module });
	const round = findRound({
		events: context.events,
		sessionId: event.sessionId,
		seq: event.seq,
		inclusive: true,
		sameModule: (other) => normalizeModule({ projectRoot, module: other }) === module,
	});
	const open = event.open === undefined ? "Issues open" : `${event.open} ${event.open === 1 ? "issue" : "issues"} open`;
	return {
		kind: "QA verdict",
		title: event.verdict === "passed" ? "Passed" : `${open} · round ${round}`,
		titleMono: false,
		meta: joinMeta([module, formatClock({ iso: event.ts, now: context.now }).clock]),
		blocks: todoText === null ? [] : buildTodoBlocks({ text: todoText }).filter((block) => block.type === "issues"),
	};
}
