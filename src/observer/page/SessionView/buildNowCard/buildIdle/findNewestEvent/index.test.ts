import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findNewestEvent from "./index.js";

function prompt({ ts, text }: { ts: string; text: string }): ObserverEvent {
	return { v: 1, ts, sessionId: "s1", pid: 1, seq: 1, kind: "prompt", text };
}

describe("findNewestEvent", () => {
	it("is null with no events", () => {
		expect(findNewestEvent({ events: [] })).toBeNull();
	});

	it("picks the latest time whatever the order, and the later event on a tie", () => {
		const events = [
			prompt({ ts: "2026-01-01T09:30:00.000Z", text: "b" }),
			prompt({ ts: "2026-01-01T09:00:00.000Z", text: "a" }),
			prompt({ ts: "2026-01-01T09:30:00.000Z", text: "c" }),
		];
		expect(findNewestEvent({ events })).toMatchObject({ text: "c" });
	});
});
