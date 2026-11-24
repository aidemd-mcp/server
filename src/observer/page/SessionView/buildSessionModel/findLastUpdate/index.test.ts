import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findLastUpdate from "./index.js";

function event(seq: number, ts: string): ObserverEvent {
	return { v: 1, ts, sessionId: "s1", pid: 1, seq, kind: "prompt", text: "x" } as ObserverEvent;
}

function clock(iso: string): string {
	const at = new Date(iso);
	return [at.getHours(), at.getMinutes(), at.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":");
}

describe("findLastUpdate", () => {
	it("is the local time of the newest event, to the second", () => {
		const newest = "2026-01-01T09:31:07.000Z";
		expect(findLastUpdate({ events: [event(1, "2026-01-01T09:00:00.000Z"), event(2, newest), event(3, "2026-01-01T09:10:00.000Z")] })).toBe(clock(newest));
	});

	it("breaks a tie on the later seq and is null with nothing held", () => {
		const ts = "2026-01-01T09:31:07.000Z";
		expect(findLastUpdate({ events: [event(2, ts), event(1, ts)] })).toBe(clock(ts));
		expect(findLastUpdate({ events: [] })).toBeNull();
	});
});
