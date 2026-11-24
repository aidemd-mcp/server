import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import joinMeta from "@/observer/page/shared/joinMeta/index.js";
import type { DrawerContext, DrawerModel } from "@/observer/page/types/index.js";
import findUnfinishedStart from "@/observer/page/SessionView/buildHeldNowCard/findUnfinishedStart/index.js";

/**
 * A commit's drawer: kind `Commit`, the short sha as a mono title, `HH:MM` and ` · during <Phase>`
 * when a phase of the commit's session had started and not finished, and the message as one block
 * (`No message reported.` when the commit carried none).
 */
export default function buildCommitDrawer({ event, context }: { event: Extract<ObserverEvent, { kind: "commit" }>; context: DrawerContext }): DrawerModel {
	const running = findUnfinishedStart({ events: context.events.filter((other) => other.seq < event.seq), sessionId: event.sessionId });
	return {
		kind: "Commit",
		title: event.sha.slice(0, 7),
		titleMono: true,
		meta: joinMeta([formatClock({ iso: event.ts, now: context.now }).clock, running === null ? null : `during ${PHASE_LABELS[running.phase]}`]),
		blocks: [{ heading: "Message", icon: "commit", badge: null, type: "pre", text: event.message ?? "No message reported." }],
	};
}
