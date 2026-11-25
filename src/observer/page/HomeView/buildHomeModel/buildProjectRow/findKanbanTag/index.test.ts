import { describe, expect, it } from "vitest";
import type { ProjectView, SessionListing } from "@/observer/types/index.js";
import findKanbanTag from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

function listing(sessionId: string, startedAt: string, kanbanTag?: string): SessionListing {
	return { sessionId, startedAt, metadata: kanbanTag ? { kanbanTag } : null, eventCount: 1, lastEventAt: startedAt, liveness: makeLiveness({ state: "ended" }) };
}

describe("findKanbanTag", () => {
	it("reads the board's tag when the board is readable", () => {
		const view = {
			state: "ready",
			projectKey: "p",
			status: { board: { state: "available", kanbanTag: "from-board" } },
		} as unknown as ProjectView;
		expect(findKanbanTag({ view, sessions: [listing("s1", "2026-01-01T09:00:00.000Z", "from-session")] })).toBe("from-board");
	});

	it("falls back to the newest listed session's reported tag", () => {
		const sessions = [listing("old", "2026-01-01T08:00:00.000Z", "old-tag"), listing("new", "2026-01-01T09:00:00.000Z", "new-tag"), listing("none", "2026-01-01T10:00:00.000Z")];
		expect(findKanbanTag({ view: undefined, sessions })).toBe("new-tag");
	});

	it("is null when nothing reports one", () => {
		expect(findKanbanTag({ view: undefined, sessions: [listing("s1", "2026-01-01T09:00:00.000Z")] })).toBeNull();
	});
});
