import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";
import joinMeta from "@/observer/page/shared/joinMeta/index.js";
import type { DrawerBlockModel, DrawerContext, DrawerModel } from "@/observer/page/types/index.js";
import findStartedAt from "@/observer/page/SessionView/buildHistoryModel/labelEvent/findStartedAt/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import findFollowingFiles from "@/observer/page/SessionView/Drawer/buildEventDrawer/findFollowingFiles/index.js";

/**
 * A finished phase's drawer: kind `Phase finished`, `<Phase> · <module>`, the agent with the span
 * `HH:MM → HH:MM · <duration>` (just `HH:MM` when no start was recorded), the summary when the
 * agent gave one, and the files written right after it as `created` / `updated` rows.
 */
export default function buildPhaseFinishedDrawer({
	event,
	context,
}: {
	event: Extract<ObserverEvent, { kind: "phase_finished" }>;
	context: DrawerContext;
}): DrawerModel {
	const projectRoot = context.status?.projectRoot ?? "";
	const startedAt = findStartedAt({ finished: event, events: context.events });
	const end = formatClock({ iso: event.ts, now: context.now }).clock;
	const span =
		startedAt === null
			? end
			: `${formatClock({ iso: startedAt, now: context.now }).clock} → ${end} · ${formatSpan((Date.parse(event.ts) - Date.parse(startedAt)) / 1000)}`;

	const blocks: DrawerBlockModel[] = [];
	if (event.summary !== undefined) blocks.push({ heading: "Summary", icon: "done", badge: null, type: "text", paras: [event.summary] });
	const files = findFollowingFiles({ event, events: context.events });
	if (files.length > 0) {
		blocks.push({
			heading: "Files written",
			icon: "files",
			badge: null,
			type: "kv",
			rows: files.map((file) => ({ key: file.action, value: normalizeModule({ projectRoot, module: file.path }), mono: true })),
		});
	}
	return {
		kind: "Phase finished",
		title: `${PHASE_LABELS[event.phase]} · ${normalizeModule({ projectRoot, module: event.module })}`,
		titleMono: false,
		meta: joinMeta([event.agent, span]),
		blocks,
	};
}
