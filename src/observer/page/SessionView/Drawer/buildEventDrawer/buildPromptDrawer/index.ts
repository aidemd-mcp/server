import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { DrawerContext, DrawerModel } from "@/observer/page/types/index.js";
import firstLine from "@/util/firstLine/index.js";
import findSessionStart from "@/observer/page/SessionView/Drawer/findSessionStart/index.js";

/**
 * A prompt's drawer: kind `Prompt · HH:MM`, its first line as the title, `session HH:MM` (the
 * session's start, left out when none is known) and the whole text as one block.
 */
export default function buildPromptDrawer({ event, context }: { event: Extract<ObserverEvent, { kind: "prompt" }>; context: DrawerContext }): DrawerModel {
	const started = findSessionStart({ sessionId: event.sessionId, sessions: context.sessions, events: context.events });
	return {
		kind: `Prompt · ${formatClock({ iso: event.ts, now: context.now }).clock}`,
		title: firstLine({ text: event.text }),
		titleMono: false,
		meta: started === null ? null : `session ${formatClock({ iso: started, now: context.now }).clock}`,
		blocks: [{ heading: "Full text", icon: "prompt", badge: null, type: "pre", text: event.text }],
	};
}
