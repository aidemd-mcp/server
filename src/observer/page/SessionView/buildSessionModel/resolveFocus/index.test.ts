import { describe, expect, it } from "vitest";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import resolveFocus from "./index.js";

function row(sessionId: string, liveness: SessionRowModel["liveness"]): SessionRowModel {
	return { sessionId, startedAt: "2026-01-01T09:00:00.000Z", lastEventAt: null, eventCount: 1, liveness, task: null, label: null };
}

describe("resolveFocus", () => {
	it("follows the pick while two sessions are active and the pick is one of them", () => {
		expect(resolveFocus({ requested: "b", routeSessionId: "a", sessions: [row("a", "live"), row("b", "idle")] })).toBe("b");
	});

	it.each([
		["one active", [row("a", "live"), row("b", "idle")]],
		["the pick has ended", [row("a", "live"), row("b", "ended"), row("c", "live")]],
		["the pick is the only one listed", [row("b", "ended")]],
	])("follows any listed session, however it stands (%s)", (_, sessions) => {
		expect(resolveFocus({ requested: "b", routeSessionId: "a", sessions })).toBe("b");
	});

	it("falls back to the link's session when the pick is not listed", () => {
		expect(resolveFocus({ requested: "b", routeSessionId: "a", sessions: [row("a", "live"), row("c", "live")] })).toBe("a");
	});
});
