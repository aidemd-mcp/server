import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import findLinkedSlugs from "./index.js";

function event(fields: Record<string, unknown>): ObserverEvent {
	return { v: 1, ts: "2026-11-23T10:00:00.000Z", pid: 1, seq: 1, ...fields } as ObserverEvent;
}

describe("findLinkedSlugs", () => {
	it("collects the slugs of the focused session's task events, picked or moved", () => {
		const events = [
			event({ kind: "task", sessionId: "s1", slug: "a", action: "picked" }),
			event({ kind: "task", sessionId: "s1", slug: "b", action: "moved", column: "done" }),
			event({ kind: "task", sessionId: "s2", slug: "c", action: "picked" }),
			event({ kind: "prompt", sessionId: "s1", text: "go" }),
		];
		expect([...findLinkedSlugs({ events, focus: "s1" })].sort()).toEqual(["a", "b"]);
	});

	it("is empty when the session picked nothing", () => {
		expect(findLinkedSlugs({ events: [], focus: "s1" }).size).toBe(0);
	});
});
