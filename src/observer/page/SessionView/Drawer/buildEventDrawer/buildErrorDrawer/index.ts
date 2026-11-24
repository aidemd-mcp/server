import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import joinMeta from "@/observer/page/shared/joinMeta/index.js";
import type { DrawerContext, DrawerModel } from "@/observer/page/types/index.js";
import firstLine from "@/util/firstLine/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

/** An error event's drawer: kind `Error`, the message's first line as the title, `<agent> · <module> · HH:MM` (each part only when reported) and the whole message as one block. */
export default function buildErrorDrawer({ event, context }: { event: Extract<ObserverEvent, { kind: "error" }>; context: DrawerContext }): DrawerModel {
	return {
		kind: "Error",
		title: firstLine({ text: event.message }),
		titleMono: false,
		meta: joinMeta([
			event.agent,
			event.module === undefined ? null : normalizeModule({ projectRoot: context.status?.projectRoot ?? "", module: event.module }),
			formatClock({ iso: event.ts, now: context.now }).clock,
		]),
		blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: event.message }],
	};
}
