import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findPreviousColumn from "./index.js";

type TaskEvent = Extract<ObserverEvent, { kind: "task" }>;

function task({ seq, ts, column, slug = "t", sessionId = "s1" }: { seq: number; ts: string; column?: string; slug?: string; sessionId?: string }): TaskEvent {
	return { v: 1, ts, sessionId, pid: 1, seq, kind: "task", slug, action: "moved", ...(column === undefined ? {} : { column }) };
}

describe("findPreviousColumn", () => {
	it("is the column of the newest earlier event of the slug", () => {
		const current = task({ seq: 3, ts: "2026-01-01T12:00:00.000Z", column: "Done" });
		const events = [task({ seq: 1, ts: "2026-01-01T10:00:00.000Z", column: "Todo" }), task({ seq: 2, ts: "2026-01-01T11:00:00.000Z", column: "In Progress" }), current];
		expect(findPreviousColumn({ event: current, events })).toBe("In Progress");
	});

	it("skips an earlier event that reported no column, and one of another slug or a later time", () => {
		const current = task({ seq: 3, ts: "2026-01-01T12:00:00.000Z", column: "Done" });
		const events = [
			task({ seq: 1, ts: "2026-01-01T10:00:00.000Z", column: "Todo" }),
			task({ seq: 2, ts: "2026-01-01T11:00:00.000Z" }),
			task({ seq: 4, ts: "2026-01-01T11:30:00.000Z", column: "Backlog", slug: "other" }),
			task({ seq: 5, ts: "2026-01-01T13:00:00.000Z", column: "Backlog" }),
			current,
		];
		expect(findPreviousColumn({ event: current, events })).toBe("Todo");
	});

	it("is null when no earlier event named a column, and orders equal times by seq within a session", () => {
		const current = task({ seq: 2, ts: "2026-01-01T12:00:00.000Z", column: "Done" });
		const sameInstantLater = task({ seq: 3, ts: "2026-01-01T12:00:00.000Z", column: "Backlog" });
		const sameInstantOtherSession = task({ seq: 1, ts: "2026-01-01T12:00:00.000Z", column: "Todo", sessionId: "s2" });
		expect(findPreviousColumn({ event: current, events: [current, sameInstantLater, sameInstantOtherSession] })).toBeNull();
		expect(findPreviousColumn({ event: sameInstantLater, events: [current, sameInstantLater] })).toBe("Done");
	});
});
