import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { DrawerContext, DrawerModel } from "@/observer/page/types/index.js";
import buildCommitDrawer from "./buildCommitDrawer/index.js";
import buildErrorDrawer from "./buildErrorDrawer/index.js";
import buildPhaseFinishedDrawer from "./buildPhaseFinishedDrawer/index.js";
import buildPromptDrawer from "./buildPromptDrawer/index.js";
import buildQaDrawer from "./buildQaDrawer/index.js";
import buildSessionStartedDrawer from "./buildSessionStartedDrawer/index.js";

/**
 * The drawer of one held event, by kind: a prompt, a commit, a finished phase, a QA verdict, an
 * error, a session start or a release. `todoText` is the verdict's module todo when the page read
 * it. Null for a kind the history never opens as an event (the caller says so in the drawer).
 */
export default function buildEventDrawer({
	event,
	context,
	todoText,
}: {
	event: ObserverEvent;
	context: DrawerContext;
	todoText: string | null;
}): DrawerModel | null {
	switch (event.kind) {
		case "prompt":
			return buildPromptDrawer({ event, context });
		case "commit":
			return buildCommitDrawer({ event, context });
		case "phase_finished":
			return buildPhaseFinishedDrawer({ event, context });
		case "qa_verdict":
			return buildQaDrawer({ event, context, todoText });
		case "error":
			return buildErrorDrawer({ event, context });
		case "session_started":
			return buildSessionStartedDrawer({ event, context });
		case "release":
			return {
				kind: "Release",
				title: event.version,
				titleMono: true,
				meta: formatClock({ iso: event.ts, now: context.now }).clock,
				blocks: [],
			};
		default:
			return null;
	}
}
