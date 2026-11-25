import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { RunningWork, Status } from "@/types/index.js";
import buildHref from "@/observer/page/route/buildHref/index.js";
import describeLiveness from "@/observer/page/shared/describeLiveness/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";
import type { LiveRowModel, SessionRowModel } from "@/observer/page/types/index.js";
import moduleLabel from "@/observer/page/HomeView/buildHomeModel/moduleLabel/index.js";

/** What the session's running phase reads as: its label, and `step n of m` after a Build's. */
function describePhase({ running }: { running: RunningWork }): string {
	const label = PHASE_LABELS[running.phase];
	if (running.phase !== "build" || running.buildStep === undefined) return label;
	return `${label} · step ${running.buildStep.reached} of ${running.buildStep.total}`;
}

/**
 * One live-sessions row. The badge is the session's liveness (`describeLiveness`: Working, Waiting
 * on you, or Quiet N min · maybe stuck). Beside it, a gate open in the session wins (its module and
 * the span it has waited); else the phase it is running (with the Build step and the time it has
 * run); else `Working outside the pipeline` when the session's rail says so, else `No phase running`. The
 * row carries the rail's pipeline beside the phase. Module and agent come only from what the status reports and are
 * left out when it reports none.
 */
export default function buildLiveRow({
	token,
	project,
	session,
	status,
	now,
}: {
	token: string;
	project: { projectKey: string; name: string };
	session: SessionRowModel;
	status: Status | null;
	now: Date;
}): LiveRowModel {
	const waiting = status?.waiting.find((file) => file.sessionId === session.sessionId);
	const running = (status?.running ?? [])
		.filter((work) => work.sessionId === session.sessionId)
		.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))[0];

	const rail = status?.rails.find((candidate) => candidate.sessionId === session.sessionId) ?? null;
	const { word, className, icon } = describeLiveness({ liveness: session.liveness, now });
	const base = {
		pipeline: rail?.pipeline ?? null,
		outside: rail?.outside ?? false,
		badge: { word, className, icon },
		key: `${project.projectKey}:${session.sessionId}`,
		project: project.name,
		start: formatClock({ iso: session.startedAt, now }).clock,
		href: buildHref({ kind: "session", token, projectKey: project.projectKey, sessionId: session.sessionId }),
	};

	if (waiting !== undefined) {
		return {
			...base,
			phase: null,
			module: moduleLabel({ folder: waiting.folder, projectName: project.name }),
			agent: null,
			elapsed: formatAgo({ iso: waiting.since, now }),
		};
	}
	if (running !== undefined) {
		return {
			...base,
			phase: describePhase({ running }),
			module: moduleLabel({ folder: running.module, projectName: project.name }),
			agent: running.agent,
			elapsed: formatSpan((now.getTime() - new Date(running.startedAt).getTime()) / 1000),
		};
	}
	return { ...base, phase: base.outside ? "Working outside the pipeline" : "No phase running", module: null, agent: null, elapsed: null };
}
