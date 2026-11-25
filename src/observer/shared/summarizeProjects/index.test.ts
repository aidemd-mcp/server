import { describe, expect, it } from "vitest";
import type { LivenessReport, ObserverEvent, SessionLiveness } from "@/types/index.js";
import type { HeldSession } from "../../types/index.js";
import summarizeProjects from "./index.js";

const DEAD_PID = 2_147_483_646;

function started({ ts, root }: { ts: string; root?: string }): ObserverEvent {
	return { v: 2, ts, sessionId: "s", seq: 1, pid: DEAD_PID, kind: "session_started", ...(root !== undefined && { projectRoot: root }) } as ObserverEvent;
}

function prompt({ ts, seq }: { ts: string; seq: number }): ObserverEvent {
	return { v: 2, ts, sessionId: "s", seq, pid: DEAD_PID, kind: "prompt", text: "hi" } as ObserverEvent;
}

function held({ projectKey, sessionId, events }: { projectKey: string; sessionId: string; events: ObserverEvent[] }): HeldSession {
	return { projectKey, sessionId, events };
}

function makeLiveness(overrides: Partial<SessionLiveness> = {}): SessionLiveness {
	return { state: "working", lastActivityAt: null, quietMinutes: 0, maybeStuck: false, ...overrides };
}

/** One report per project holding every given session, each judged by `pick` (working unless it says otherwise). */
function reportsFor(
	sessions: HeldSession[],
	pick: (sessionId: string) => SessionLiveness = () => makeLiveness(),
): Map<string, LivenessReport> {
	const reports = new Map<string, LivenessReport>();
	for (const { projectKey, sessionId } of sessions) {
		const report = reports.get(projectKey) ?? { sessions: {}, unlinked: [] };
		report.sessions[sessionId] = pick(sessionId);
		reports.set(projectKey, report);
	}
	return reports;
}

describe("summarizeProjects", () => {
	it("lists a project whose sessions never reported a root with projectRoot null and its sessions", () => {
		const sessions = [held({ projectKey: "gamma-cccccc", sessionId: "c1", events: [started({ ts: "2026-01-01T00:00:00.000Z" })] })];

		const projects = summarizeProjects({ sessions, liveness: reportsFor(sessions) });

		expect(projects).toHaveLength(1);
		expect(projects[0]).toMatchObject({ projectKey: "gamma-cccccc", projectRoot: null, lastEventAt: "2026-01-01T00:00:00.000Z" });
		expect(projects[0].sessions.map((s) => s.sessionId)).toEqual(["c1"]);
	});

	it("takes the root from the newest session_started only, never filling from an older one", () => {
		const sessions = [
			held({ projectKey: "a-aaaaaa", sessionId: "old", events: [started({ ts: "2026-01-01T00:00:00.000Z", root: "/old" })] }),
			held({ projectKey: "a-aaaaaa", sessionId: "new", events: [started({ ts: "2026-01-01T01:00:00.000Z" })] }),
		];

		const projects = summarizeProjects({ sessions, liveness: reportsFor(sessions) });

		expect(projects[0].projectRoot).toBeNull();
	});

	it("copies each session's liveness from its own project's report", () => {
		const sessions = [
			held({ projectKey: "a-aaaaaa", sessionId: "recent", events: [started({ ts: "2026-01-01T11:50:00.000Z", root: "/a" })] }),
			held({ projectKey: "a-aaaaaa", sessionId: "old", events: [started({ ts: "2026-01-01T00:00:00.000Z", root: "/a" })] }),
			held({ projectKey: "b-bbbbbb", sessionId: "other", events: [started({ ts: "2026-01-01T05:00:00.000Z", root: "/b" })] }),
		];
		const ended = makeLiveness({ state: "ended", endedBy: "user" });
		const waiting = makeLiveness({ state: "waiting" });

		const projects = summarizeProjects({
			sessions,
			liveness: reportsFor(sessions, (id) => (id === "old" ? ended : id === "recent" ? waiting : makeLiveness())),
		});

		const states = Object.fromEntries(projects.flatMap((p) => p.sessions.map((s) => [s.sessionId, s.liveness.state])));
		expect(states).toEqual({ recent: "waiting", old: "ended", other: "working" });
	});

	it("orders projects by latest event descending, ties by key", () => {
		const at = (ts: string) => [started({ ts }), prompt({ ts, seq: 2 })];
		const sessions = [
			held({ projectKey: "b-bbbbbb", sessionId: "b", events: at("2026-01-01T02:00:00.000Z") }),
			held({ projectKey: "a-aaaaaa", sessionId: "a", events: at("2026-01-01T02:00:00.000Z") }),
			held({ projectKey: "c-cccccc", sessionId: "c", events: at("2026-01-01T03:00:00.000Z") }),
			held({ projectKey: "d-dddddd", sessionId: "d", events: at("2026-01-01T01:00:00.000Z") }),
		];

		const projects = summarizeProjects({ sessions, liveness: reportsFor(sessions) });

		expect(projects.map((p) => p.projectKey)).toEqual(["c-cccccc", "a-aaaaaa", "b-bbbbbb", "d-dddddd"]);
	});

	it("answers an empty list for no sessions", () => {
		expect(summarizeProjects({ sessions: [], liveness: new Map() })).toEqual([]);
	});

	it("throws for a project whose liveness was not read", () => {
		const sessions = [held({ projectKey: "a-aaaaaa", sessionId: "a", events: [started({ ts: "2026-01-01T00:00:00.000Z" })] })];

		expect(() => summarizeProjects({ sessions, liveness: new Map() })).toThrow("No liveness was read for project a-aaaaaa.");
	});
});
