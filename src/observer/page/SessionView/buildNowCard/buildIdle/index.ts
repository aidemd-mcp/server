import type { ObserverEvent, PipelineRail } from "@/types/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import type { NowCardModel, NowCardPart } from "@/observer/page/types/index.js";
import labelEvent from "@/observer/page/SessionView/buildHistoryModel/labelEvent/index.js";
import findNewestEvent from "./findNewestEvent/index.js";

type PhaseEvent = Extract<ObserverEvent, { kind: "phase_started" | "phase_finished" }>;

/** The module and agent of the newest phase event (each only when one reported), in the order the card prints them. */
function describeLastPhase({ events }: { events: ObserverEvent[] }): NowCardPart[] {
	const last = events
		.filter((event): event is PhaseEvent => event.kind === "phase_started" || event.kind === "phase_finished")
		.reduce<PhaseEvent | null>((best, event) => (best === null || event.ts >= best.ts ? event : best), null);
	if (!last) return [];
	return [
		{ label: "module", value: last.module, mono: true },
		{ label: "agent", value: last.agent, mono: true },
	];
}

/**
 * The card for nothing running after real activity: how long since the newest event, what that
 * event was (worded as the history panel words it, with its slug, sha or file as the mono part)
 * and the module and agent of the newest phase event. `events` must hold at least one event;
 * `projectRoot` is `""` when the project reported none. When the session has a rail, the state
 * word says what the session is doing instead of idling: `Working outside the pipeline` when the
 * rail says so, else `No phase running`, and the rail's pipeline is named.
 */
export default function buildIdle({
	events,
	projectRoot,
	now,
	rail = null,
}: {
	events: ObserverEvent[];
	projectRoot: string;
	now: Date;
	rail?: Pick<PipelineRail, "pipeline" | "outside"> | null;
}): NowCardModel {
	const newest = findNewestEvent({ events });
	if (!newest) throw new Error("buildIdle needs at least one event");
	const { kind, label, mono } = labelEvent({ event: newest, events, projectRoot });
	const span = formatAgo({ iso: newest.ts, now });
	return {
		kind: "idle",
		state: rail === null ? `Idle — no events for ${span}` : rail.outside ? "Working outside the pipeline" : "No phase running",
		icon: "idle",
		title: `Last: ${kind === "sub" ? "Wrote " : ""}${label}`,
		titleMono: mono,
		sub: null,
		parts: describeLastPhase({ events }),
		time: span,
		timeLabel: "since last event",
		steps: null,
		hint: null,
		pipeline: rail?.pipeline ?? null,
	};
}
