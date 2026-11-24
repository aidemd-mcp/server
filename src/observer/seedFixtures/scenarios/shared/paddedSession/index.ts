import { SECONDS_PER_MINUTE } from "@/util/timeUnits/index.js";
import type { FixtureEvent, FixtureSession } from "@/observer/seedFixtures/types/index.js";

/**
 * One session of the handoff's session lists (`mk(...)`): it starts `startAgoMin` minutes ago, holds
 * `events` events and picked `task`. Without `workEvents` it ends `durationSec` seconds after it started (required then); with
 * them, its padding stops at the first of them and they close the session. Real events are the session start,
 * the task it picked, then `workEvents` (offsets already in minutes before now, in time order); the rest are
 * `prompt` events spread evenly between the task and the end of the padding, to meet the count, the last of
 * them at the end of that span.
 */
export default function paddedSession({
	pid,
	startAgoMin,
	durationSec = 0,
	events,
	task,
	workEvents = [],
}: {
	pid: FixtureSession["pid"];
	startAgoMin: number;
	durationSec?: number;
	events: number;
	task: { slug: string; title: string };
	workEvents?: FixtureEvent[];
}): FixtureSession {
	const prompts = events - 2 - workEvents.length;
	const spanSec = workEvents.length > 0 ? (startAgoMin - workEvents[0].offsetMin) * SECONDS_PER_MINUTE : durationSec;
	const step = spanSec / prompts;
	const at = (afterSec: number) => startAgoMin - afterSec / SECONDS_PER_MINUTE;

	return {
		pid,
		events: [
			{ offsetMin: at(0), kind: "session_started" },
			{ offsetMin: at(Math.min(20, step / 2)), kind: "task", slug: task.slug, title: task.title, action: "picked", column: "In Progress" },
			...Array.from({ length: prompts }, (_, index) => ({
				offsetMin: at(step * (index + 1)),
				kind: "prompt" as const,
				text: "Continue.",
			})),
			...workEvents,
		],
	};
}
