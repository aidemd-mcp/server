import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import hasActivity from "./index.js";

function event(kind: "session_started" | "prompt" | "phase_started" | "task" | "file_written" | "commit" | "error"): ObserverEvent {
	const base = { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId: "s1", pid: 1, seq: 1 } as const;
	switch (kind) {
		case "session_started":
			return { ...base, kind };
		case "prompt":
			return { ...base, kind, text: "go" };
		case "phase_started":
			return { ...base, kind, pipeline: "p", phase: "spec", agent: "a", module: "m" };
		case "task":
			return { ...base, kind, slug: "t", action: "picked" };
		case "file_written":
			return { ...base, kind, path: "a.ts", action: "created" };
		case "commit":
			return { ...base, kind, sha: "abc1234" };
		case "error":
			return { ...base, kind, message: "boom" };
	}
}

describe("hasActivity", () => {
	it("is false with no event, or only the opening and prompts", () => {
		expect(hasActivity({ events: [] })).toBe(false);
		expect(hasActivity({ events: [event("session_started"), event("prompt")] })).toBe(false);
	});

	it.each(["phase_started", "task", "file_written", "commit", "error"] as const)("is true once a %s event exists", (kind) => {
		expect(hasActivity({ events: [event("session_started"), event(kind)] })).toBe(true);
	});
});
