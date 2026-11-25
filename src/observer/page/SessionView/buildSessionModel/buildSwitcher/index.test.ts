import { describe, expect, it } from "vitest";
import type { Status } from "@/types/index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import buildSwitcher from "./index.js";

const NOW = new Date("2026-01-01T10:00:00.000Z");

function row(sessionId: string, startedAt: string, state: SessionRowModel["liveness"]["state"] = "working"): SessionRowModel {
	return { sessionId, startedAt, lastEventAt: startedAt, eventCount: 1, liveness: makeLiveness({ state }), task: null, label: null };
}

const clockOf = (iso: string) => {
	const at = new Date(iso);
	return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

const A = "2026-01-01T09:00:00.000Z";
const B = "2026-01-01T09:30:00.000Z";

describe("buildSwitcher", () => {
	it("is empty with fewer than two active sessions", () => {
		expect(buildSwitcher({ sessions: [row("a", A)], status: null, focus: "a", name: "app", now: NOW })).toEqual([]);
		expect(buildSwitcher({ sessions: [row("a", A), row("b", B, "ended")], status: null, focus: "a", name: "app", now: NOW })).toEqual([]);
	});

	it("lists active sessions in start order with the followed one pressed and the phase and module each runs", () => {
		const status = {
			waiting: [],
			running: [{ sessionId: "a", phase: "plan", agent: "x", module: "src/tools/score", startedAt: A, elapsedMs: 1 }],
		} as unknown as Status;
		const options = buildSwitcher({ sessions: [row("b", B), row("a", A)], status, focus: "b", name: "app", now: NOW });
		expect(options).toEqual([
			{ id: "a", start: clockOf(A), now: "Plan · src/tools/score", pressed: false },
			{ id: "b", start: clockOf(B), now: "No phase running", pressed: true },
		]);
	});

	it("says Waiting on you for a session with an open gate, and names the root module by the project", () => {
		const status = {
			waiting: [{ sessionId: "a", file: ".aide/intent.aide", folder: ".", kind: "intent", gate: "g", seq: 1, since: A }],
			running: [{ sessionId: "b", phase: "build", agent: "x", module: ".", startedAt: B, elapsedMs: 1 }],
		} as unknown as Status;
		const options = buildSwitcher({ sessions: [row("a", A), row("b", B, "waiting")], status, focus: "a", name: "app", now: NOW });
		expect(options.map((option) => option.now)).toEqual(["Waiting on you", "Build · app"]);
	});
});
