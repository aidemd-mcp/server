import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import buildIdleRail from "./index.js";

let seq = 0;
function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; sessionId?: string }): ObserverEvent {
	seq += 1;
	return { v: 1, ts: "2026-01-01T09:00:00.000Z", sessionId: "s1", seq, pid: 1, ...fields } as ObserverEvent;
}

const finished = (phase: string, module: string, sessionId = "s1") => event({ kind: "phase_finished", phase, agent: "a", module, sessionId });

describe("buildIdleRail", () => {
	it("is null when no event names a module", () => {
		expect(buildIdleRail({ events: [event({ kind: "session_started" })], projectRoot: "/work/app" })).toBeNull();
	});

	it("takes the newest module and the phases its session finished for it", () => {
		const events = [finished("spec", "src/a"), finished("build", "src/b"), finished("qa", "/work/app/src/b")];
		const rail = buildIdleRail({ events, projectRoot: "/work/app" });
		expect(rail?.module).toBe("/work/app/src/b");
		expect(rail?.sessionId).toBe("s1");
		const done = rail?.phases.filter((phase) => phase.state === "done").map((phase) => phase.phase);
		expect(done).toEqual(["build", "qa"]);
		expect(rail?.phases.every((phase) => phase.state !== "running")).toBe(true);
	});

	it("limits the module to the given session", () => {
		const events = [finished("plan", "src/a", "s1"), finished("build", "src/b", "s2")];
		expect(buildIdleRail({ events, projectRoot: "/work/app", sessionId: "s1" })?.module).toBe("src/a");
		expect(buildIdleRail({ events, projectRoot: "/work/app", sessionId: "s3" })).toBeNull();
	});

	it("does not count a started phase as done", () => {
		const events = [event({ kind: "phase_started", phase: "build", agent: "a", module: "src/a" })];
		const rail = buildIdleRail({ events, projectRoot: "/work/app" });
		expect(rail?.phases.every((phase) => phase.state === "not-run")).toBe(true);
	});
});
