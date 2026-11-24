import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findKanbanTag from "./index.js";

function started(ts: string, kanbanTag?: string): ObserverEvent {
	return { v: 1, ts, sessionId: "s1", pid: 1, seq: 1, kind: "session_started", ...(kanbanTag ? { kanbanTag } : {}) } as ObserverEvent;
}

describe("findKanbanTag", () => {
	it("is the tag of the newest session_started that reported one", () => {
		const events = [started("2026-01-01T09:00:00.000Z", "old"), started("2026-01-01T10:00:00.000Z", "new"), started("2026-01-01T11:00:00.000Z")];
		expect(findKanbanTag({ events })).toBe("new");
	});

	it("is undefined when no event reported a tag", () => {
		expect(findKanbanTag({ events: [started("2026-01-01T09:00:00.000Z")] })).toBeUndefined();
		expect(findKanbanTag({ events: [] })).toBeUndefined();
	});
});
