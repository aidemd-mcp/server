import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { HeldSession } from "../../types/index.js";
import summarizeProjects from "./index.js";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const DEAD_PID = 2_147_483_646;

function started({ ts, root }: { ts: string; root?: string }): ObserverEvent {
	return { v: 1, ts, sessionId: "s", seq: 1, pid: DEAD_PID, kind: "session_started", ...(root !== undefined && { projectRoot: root }) } as ObserverEvent;
}

function prompt({ ts, seq }: { ts: string; seq: number }): ObserverEvent {
	return { v: 1, ts, sessionId: "s", seq, pid: DEAD_PID, kind: "prompt", text: "hi" } as ObserverEvent;
}

function held({ projectKey, sessionId, events }: { projectKey: string; sessionId: string; events: ObserverEvent[] }): HeldSession {
	return { projectKey, sessionId, events };
}

describe("summarizeProjects", () => {
	it("lists a project whose sessions never reported a root with projectRoot null and its sessions", () => {
		const projects = summarizeProjects({
			sessions: [held({ projectKey: "gamma-cccccc", sessionId: "c1", events: [started({ ts: "2026-01-01T00:00:00.000Z" })] })],
			now: NOW,
		});

		expect(projects).toHaveLength(1);
		expect(projects[0]).toMatchObject({ projectKey: "gamma-cccccc", projectRoot: null, lastEventAt: "2026-01-01T00:00:00.000Z" });
		expect(projects[0].sessions.map((s) => s.sessionId)).toEqual(["c1"]);
	});

	it("takes the root from the newest session_started only, never filling from an older one", () => {
		const projects = summarizeProjects({
			sessions: [
				held({ projectKey: "a-aaaaaa", sessionId: "old", events: [started({ ts: "2026-01-01T00:00:00.000Z", root: "/old" })] }),
				held({ projectKey: "a-aaaaaa", sessionId: "new", events: [started({ ts: "2026-01-01T01:00:00.000Z" })] }),
			],
			now: NOW,
		});

		expect(projects[0].projectRoot).toBeNull();
	});

	it("flags a recent session live and an old one with a dead pid ended", () => {
		const projects = summarizeProjects({
			sessions: [
				held({ projectKey: "a-aaaaaa", sessionId: "recent", events: [started({ ts: "2026-01-01T11:50:00.000Z", root: "/a" })] }),
				held({ projectKey: "a-aaaaaa", sessionId: "old", events: [started({ ts: "2026-01-01T00:00:00.000Z", root: "/a" })] }),
			],
			now: NOW,
		});

		expect(Object.fromEntries(projects[0].sessions.map((s) => [s.sessionId, s.live]))).toEqual({ recent: true, old: false });
	});

	it("orders projects by latest event descending, ties by key", () => {
		const at = (ts: string) => [started({ ts }), prompt({ ts, seq: 2 })];
		const projects = summarizeProjects({
			sessions: [
				held({ projectKey: "b-bbbbbb", sessionId: "b", events: at("2026-01-01T02:00:00.000Z") }),
				held({ projectKey: "a-aaaaaa", sessionId: "a", events: at("2026-01-01T02:00:00.000Z") }),
				held({ projectKey: "c-cccccc", sessionId: "c", events: at("2026-01-01T03:00:00.000Z") }),
				held({ projectKey: "d-dddddd", sessionId: "d", events: at("2026-01-01T01:00:00.000Z") }),
			],
			now: NOW,
		});

		expect(projects.map((p) => p.projectKey)).toEqual(["c-cccccc", "a-aaaaaa", "b-bbbbbb", "d-dddddd"]);
	});

	it("answers an empty list for no sessions", () => {
		expect(summarizeProjects({ sessions: [], now: NOW })).toEqual([]);
	});
});
