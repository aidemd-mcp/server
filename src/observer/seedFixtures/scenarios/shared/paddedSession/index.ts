import { SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";
import type { FixtureEvent, FixturePresence, FixtureSession } from "@/observer/seedFixtures/types/index.js";

/**
 * One session of the handoff's session lists (`mk(...)`): it starts `startAgoMin` minutes ago, holds
 * `events` events and picked `task`. Without `workEvents` it ends `durationSec` seconds after it started (required then); with
 * them, its padding stops at the first of them and they close the session. Real events are the session start,
 * the task it picked, then `workEvents` (offsets already in minutes before now, in time order); the rest are
 * `prompt` events spread evenly between the task and the end of the padding, to meet the count, the last of
 * them at the end of that span. When there are `workEvents`, a `pipeline_started` for the task's slug follows the
 * task (it counts toward `events`), so the work events' pipeline has a start; `workEvents` name that pipeline.
 * A `dead` session is also written with an ended mark; `presence` is the hook presence a live one carries.
 */
export default function paddedSession({
	pid,
	startAgoMin,
	durationSec = 0,
	events,
	task,
	workEvents = [],
	presence,
}: {
	pid: FixtureSession["pid"];
	startAgoMin: number;
	durationSec?: number;
	events: number;
	task: { slug: string; title: string };
	workEvents?: FixtureEvent[];
	presence?: FixturePresence;
}): FixtureSession {
	const firstPhase = workEvents.find((event) => "phase" in event);
	const prompts = events - 2 - (firstPhase === undefined ? 0 : 1) - workEvents.length;
	const spanSec = workEvents.length > 0 ? (startAgoMin - workEvents[0].offsetMin) * SECONDS_PER_MINUTE : durationSec;
	const step = spanSec / prompts;
	const at = (afterSec: number) => startAgoMin - afterSec / SECONDS_PER_MINUTE;

	const taskAt = Math.min(20, step / 2);
	// The last padding prompt lands on the first work event (or now); float error must not push it past.
	const newest = workEvents[0]?.offsetMin ?? 0;

	return {
		pid,
		...(presence !== undefined ? { presence } : {}),
		...(pid === "dead" ? { ended: true } : {}),
		events: [
			{ offsetMin: at(0), kind: "session_started" },
			{ offsetMin: at(taskAt), kind: "task", slug: task.slug, title: task.title, action: "picked", column: "In Progress" },
			...(firstPhase !== undefined && "phase" in firstPhase
				? [{ offsetMin: at(taskAt + step / 4), kind: "pipeline_started" as const, pipeline: task.slug, phase: firstPhase.phase }]
				: []),
			...Array.from({ length: prompts }, (_, index) => ({
				offsetMin: Math.max(newest, at(step * (index + 1))),
				kind: "prompt" as const,
				text: "Continue.",
			})),
			...workEvents,
		],
	};
}
