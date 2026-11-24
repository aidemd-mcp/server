import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";

/**
 * The card for a session that has opened but started no phase: it says so and when the session
 * started (the focused session's `session_started` event, else the first one held; no part when none).
 */
export default function buildEmpty({ events, focus, now }: { events: ObserverEvent[]; focus: string | null; now: Date }): NowCardModel {
	const started = events.filter((event) => event.kind === "session_started");
	const opening = started.find((event) => event.sessionId === focus) ?? started[0];
	return {
		kind: "empty",
		state: "No activity yet",
		icon: "clock",
		title: "Waiting for the first phase",
		titleMono: null,
		sub: null,
		parts: opening ? [{ label: "session started", value: formatClock({ iso: opening.ts, now }).clock, mono: true }] : [],
		time: null,
		timeLabel: null,
		steps: null,
		hint: "The agent hasn’t started a phase. The rail and this card light up as soon as one begins.",
	};
}
