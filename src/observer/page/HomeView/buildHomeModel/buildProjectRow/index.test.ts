import { describe, expect, it } from "vitest";
import type { SessionSummary } from "@/types/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import type { ProjectListing, ProjectView, SessionListing } from "@/observer/types/index.js";
import buildProjectRow from "./index.js";

const NOW = new Date(2026, 10, 23, 14, 34, 0);
const at = (hours: number, minutes: number): string => new Date(2026, 10, 23, hours, minutes).toISOString();

function listing(overrides: Partial<SessionListing> & { sessionId: string }): SessionListing {
	return { startedAt: at(9, 0), metadata: null, eventCount: 3, lastEventAt: at(9, 10), live: false, ...overrides };
}

function project(overrides: Partial<ProjectListing> = {}): ProjectListing {
	return { projectKey: "app-abc123", projectRoot: "/work/app", sessions: [], lastEventAt: null, ...overrides };
}

function summary(overrides: Partial<SessionSummary> & { sessionId: string }): SessionSummary {
	return { startedAt: at(9, 0), lastEventAt: at(9, 10), eventCount: 3, pid: 1, liveness: "ended", reported: null, ...overrides };
}

function build({ view, listings, listed = project() }: { view?: ProjectView; listings?: SessionListing[]; listed?: ProjectListing } = {}) {
	return buildProjectRow({ token: "tok", project: listed, view, listings, held: [], now: NOW });
}

describe("buildProjectRow", () => {
	it("takes its sessions from the ready status when there is one", () => {
		const view: ProjectView = { state: "ready", projectKey: "app-abc123", status: makeStatus({ sessions: [summary({ sessionId: "s1", liveness: "live" })] }) };
		const row = build({ view, listed: project({ sessions: [listing({ sessionId: "listed" })] }) });
		expect(row.rows.map((entry) => entry.sessionId)).toEqual(["s1"]);
		expect(row.liveCount).toBe(1);
	});

	it("takes its sessions from the sessions frame ahead of the project's own listing", () => {
		const row = build({ listings: [listing({ sessionId: "frame" })], listed: project({ sessions: [listing({ sessionId: "listed" })] }) });
		expect(row.rows.map((entry) => entry.sessionId)).toEqual(["frame"]);
	});

	it("falls back to the project's own listing", () => {
		const row = build({ listed: project({ sessions: [listing({ sessionId: "listed" })] }) });
		expect(row.rows.map((entry) => entry.sessionId)).toEqual(["listed"]);
	});

	it("names the project by its root's last segment, else by its key without the hash", () => {
		expect(build().name).toBe("app");
		expect(build({ listed: project({ projectRoot: null }) }).name).toBe("app");
		expect(build({ listed: project({ projectRoot: null }) }).root).toBeNull();
	});

	it("takes the root from the status when the listing reports none", () => {
		const view: ProjectView = { state: "ready", projectKey: "app-abc123", status: makeStatus({ projectRoot: "/work/other" }) };
		const row = build({ view, listed: project({ projectRoot: null }) });
		expect(row.root).toBe("/work/other");
		expect(row.name).toBe("other");
	});

	it("counts live and idle sessions, not ended ones", () => {
		const view: ProjectView = {
			state: "ready",
			projectKey: "app-abc123",
			status: makeStatus({ sessions: [summary({ sessionId: "a", liveness: "live" }), summary({ sessionId: "b", liveness: "idle" }), summary({ sessionId: "c", liveness: "ended" })] }),
		};
		expect(build({ view }).liveCount).toBe(2);
	});

	it("marks the project waiting only when the status holds an open gate", () => {
		const waiting = { file: "p.aide", folder: "src/a", kind: "plan" as const, gate: "g", sessionId: "s1", seq: 1, since: at(14, 0) };
		const view = (open: boolean): ProjectView => ({ state: "ready", projectKey: "app-abc123", status: makeStatus({ waiting: open ? [waiting] : [] }) });
		expect(build({ view: view(true) }).waiting).toBe(true);
		expect(build({ view: view(false) }).waiting).toBe(false);
		expect(build().waiting).toBe(false);
	});

	it("words the last activity from the newest event and leaves it null with none", () => {
		const row = build({ listings: [listing({ sessionId: "s1", lastEventAt: at(14, 4) })] });
		expect(row.lastEventAt).toBe(at(14, 4));
		expect(row.lastActivity).toBe("30m ago");
		const empty = build();
		expect(empty.lastEventAt).toBeNull();
		expect(empty.lastActivity).toBeNull();
	});

	it("links the open action to the newest session, null with no sessions", () => {
		const row = build({ listings: [listing({ sessionId: "old", startedAt: at(8, 0) }), listing({ sessionId: "new", startedAt: at(10, 0) })] });
		expect(row.openHref).toBe("/p/app-abc123/s/new?token=tok");
		expect(build().openHref).toBeNull();
	});

	it("reports the kanban tag of the newest listed session when no board is readable", () => {
		const row = build({ listings: [listing({ sessionId: "s1", metadata: { kanbanTag: "app" } as SessionListing["metadata"] })] });
		expect(row.kanbanTag).toBe("app");
	});
});
