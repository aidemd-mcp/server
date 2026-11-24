import type { ObserverEvent, Status } from "@/types/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import buildEmpty from "./buildEmpty/index.js";
import buildFix from "./buildFix/index.js";
import buildIdle from "./buildIdle/index.js";
import buildRun from "./buildRun/index.js";
import buildWait from "./buildWait/index.js";
import formatRunningFor from "./formatRunningFor/index.js";
import hasActivity from "./hasActivity/index.js";
import isFixRound from "./isFixRound/index.js";

/**
 * The now card of a project with a status. The first state that holds wins: an open gate (the
 * focused session's, else any) is `wait`, the loudest; the focused session's running work (else the
 * first running) is `fix` for the Fix phase and from QA round 2, else `run`; nothing running after
 * real activity is `idle`; anything less is `empty`. Every field is reported data. `stepText` is the
 * running Build step's own words, read by the session view from the plan file once it loads.
 */
export default function buildNowCard({
	status,
	events,
	focus,
	now,
	stepText,
}: {
	status: Status;
	events: ObserverEvent[];
	focus: string | null;
	now: Date;
	stepText?: string | null;
}): NowCardModel {
	const waiting = status.waiting.find((file) => file.sessionId === focus) ?? status.waiting[0];
	if (waiting) return buildWait({ status, events, waiting, now });

	const work = status.running.find((candidate) => candidate.sessionId === focus) ?? status.running[0];
	if (work && isFixRound({ work })) return buildFix({ status, events, work, now });
	if (work) {
		const elapsed = formatRunningFor({ elapsedMs: work.elapsedMs, asOf: status.generatedAt, now });
		return buildRun({ work, elapsed, stepText: stepText ?? null, now });
	}

	if (hasActivity({ events })) return buildIdle({ events, projectRoot: status.projectRoot, now });
	return buildEmpty({ events, focus, now });
}
