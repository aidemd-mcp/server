import type { ObserverEvent } from "@/types/index.js";
import formatElapsed from "@/observer/page/shared/formatElapsed/index.js";
import type { NowCardModel } from "@/observer/page/types/index.js";
import buildEmpty from "@/observer/page/SessionView/buildNowCard/buildEmpty/index.js";
import buildIdle from "@/observer/page/SessionView/buildNowCard/buildIdle/index.js";
import buildRun from "@/observer/page/SessionView/buildNowCard/buildRun/index.js";
import hasActivity from "@/observer/page/SessionView/buildNowCard/hasActivity/index.js";
import findUnfinishedStart from "./findUnfinishedStart/index.js";

/**
 * The now card for a project with no status (no reported root, or nothing received yet), from the
 * held events alone: a phase the focused session started and has not finished is `run` (without a
 * step bar, as no plan file is read); else `idle` once anything beyond the opening is held, else
 * `empty`. No waiting or fix card, since those need the status.
 */
export default function buildHeldNowCard({
	events,
	focus,
	now,
}: {
	events: ObserverEvent[];
	focus: string | null;
	now: Date;
}): NowCardModel {
	const started = findUnfinishedStart({ events, sessionId: focus });
	if (started) {
		const elapsed = formatElapsed((now.getTime() - Date.parse(started.ts)) / 1000);
		return buildRun({ work: { phase: started.phase, agent: started.agent, module: started.module, startedAt: started.ts }, elapsed, stepText: null, now });
	}

	if (hasActivity({ events })) return buildIdle({ events, projectRoot: "", now });
	return buildEmpty({ events, focus, now });
}
