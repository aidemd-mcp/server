import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { Status } from "@/types/index.js";
import moduleLabel from "@/observer/page/HomeView/buildHomeModel/moduleLabel/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import isActiveSession from "@/observer/page/shared/isActiveSession/index.js";
import type { SessionRowModel, SwitcherOption } from "@/observer/page/types/index.js";

/** What one session is doing, in the switcher's second line: its open gate, else its newest running phase and module, else that no phase runs. */
function describeNow({ status, sessionId, name }: { status: Status | null; sessionId: string; name: string }): string {
	if (status?.waiting.some((file) => file.sessionId === sessionId)) return "Waiting on you";
	const running = (status?.running ?? [])
		.filter((work) => work.sessionId === sessionId)
		.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))[0];
	if (running === undefined) return "No phase running";
	return `${PHASE_LABELS[running.phase]} · ${moduleLabel({ folder: running.module, projectName: name })}`;
}

/**
 * The header switcher's options: one per live or idle session, in start order, each its start and
 * what it is doing now; the one the view follows is pressed. Empty unless two or more sessions are
 * active, since one session needs no switch.
 */
export default function buildSwitcher({
	sessions,
	status,
	focus,
	name,
	now,
}: {
	sessions: SessionRowModel[];
	status: Status | null;
	focus: string;
	name: string;
	now: Date;
}): SwitcherOption[] {
	const active = sessions.filter(isActiveSession);
	if (active.length < 2) return [];
	return active
		.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : a.sessionId < b.sessionId ? -1 : 1))
		.map((session) => ({
			id: session.sessionId,
			start: formatClock({ iso: session.startedAt, now }).clock,
			now: describeNow({ status, sessionId: session.sessionId, name }),
			pressed: session.sessionId === focus,
		}));
}
