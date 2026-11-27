import { describe, it, expect } from "vitest";
import type { EndedMark } from "@/service/observer/event/shared/endedMark/index.js";
import pickDecidingMark from "./index.js";

const A = "20261125T090000000Z-aaaaaa";

function makeMark(endedBy: EndedMark["endedBy"], endedAt: string, sessionId = A): EndedMark {
	return { v: 1, sessionId, endedAt, endedBy };
}

describe("pickDecidingMark", () => {
	it("answers null for no marks", () => {
		expect(pickDecidingMark({ marks: [] })).toBeNull();
	});

	it("picks the newest mark when none is a user mark", () => {
		const old = makeMark("hook", "2026-11-25T10:00:00.000Z");
		const fresh = makeMark("transcript", "2026-11-25T11:00:00.000Z");

		expect(pickDecidingMark({ marks: [old, fresh] })).toBe(fresh);
		expect(pickDecidingMark({ marks: [fresh, old] })).toBe(fresh);
	});

	it("lets a user mark beat a newer hook mark", () => {
		const user = makeMark("user", "2026-11-25T10:00:00.000Z");
		const hook = makeMark("hook", "2026-11-25T11:00:00.000Z");

		expect(pickDecidingMark({ marks: [hook, user] })).toBe(user);
	});

	it("picks the newest of several user marks", () => {
		const old = makeMark("user", "2026-11-25T10:00:00.000Z");
		const fresh = makeMark("user", "2026-11-25T10:30:00.000Z");

		expect(pickDecidingMark({ marks: [old, fresh] })).toBe(fresh);
	});

	it("keeps the earlier entry on a tie", () => {
		const first = makeMark("hook", "2026-11-25T10:00:00.000Z");
		const second = makeMark("hook", "2026-11-25T10:00:00.000Z");

		expect(pickDecidingMark({ marks: [first, second] })).toBe(first);
	});
});
