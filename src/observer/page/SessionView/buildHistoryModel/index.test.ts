import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import type { SessionRowModel } from "@/observer/page/types/index.js";
import buildHistoryModel from "./index.js";
import makeLiveness from "@/observer/page/__fixtures__/makeLiveness/index.js";

const NOW = new Date(2026, 0, 1, 16, 0, 0);

function local({ hour, minute, second = 0 }: { hour: number; minute: number; second?: number }): string {
	return new Date(2026, 0, 1, hour, minute, second).toISOString();
}

function event(fields: Record<string, unknown> & { kind: ObserverEvent["kind"]; seq: number; sessionId?: string }): ObserverEvent {
	return { v: 1, sessionId: "s1", pid: 1, ts: local({ hour: 14, minute: 0 }), ...fields } as ObserverEvent;
}

function session({ sessionId, startedAt, liveness }: { sessionId: string; startedAt: string; liveness: SessionRowModel["liveness"] }): SessionRowModel {
	return { sessionId, startedAt, lastEventAt: startedAt, eventCount: 1, liveness, task: null, label: null };
}

function modelOf({ events, sessions = [], focus = "s1" }: { events: ObserverEvent[]; sessions?: SessionRowModel[]; focus?: string }) {
	return buildHistoryModel({ events, sessions, focus, projectRoot: "/work/app", now: NOW });
}

const ONE_SESSION: ObserverEvent[] = [
	event({ kind: "session_started", seq: 1, projectRoot: "/work/app", kanbanTag: "app", ts: local({ hour: 14, minute: 2 }) }),
	event({ kind: "phase_started", seq: 2, phase: "build", agent: "aide-implementor", module: "src/a", ts: local({ hour: 14, minute: 3 }) }),
	event({ kind: "file_written", seq: 3, path: "/work/app/src/a/x.ts", action: "created", ts: local({ hour: 14, minute: 4 }) }),
	event({ kind: "file_written", seq: 4, path: "src/a/y.ts", action: "updated", ts: local({ hour: 14, minute: 4, second: 30 }) }),
	event({ kind: "plan_step_checked", seq: 5, module: "src/a", step: "1", total: 3, ts: local({ hour: 14, minute: 5 }) }),
];

describe("buildHistoryModel", () => {
	it("words one row per event, oldest first, with file writes folded under the row before them", () => {
		const { rows, total } = modelOf({ events: ONE_SESSION });

		expect(total).toBe(5);
		expect(rows.map((row) => [row.time, row.kind, row.label])).toEqual([
			["14:02", "start", "Session started"],
			["14:03", "phase", "Build started"],
			["14:05", "step", "Plan step checked · 1/3"],
		]);
		const group = rows[1]!.files[0]!;
		expect(group).toMatchObject({ kind: "files", label: "Wrote 2 files", icon: "files", kindWord: "files written: " });
		expect(group.files.map((sub) => [sub.kindWord, sub.label, sub.icon])).toEqual([
			["created: ", "src/a/x.ts", "file"],
			["updated: ", "src/a/y.ts", "file"],
		]);
		expect(rows[0]).toMatchObject({ day: "Today", icon: "power", kindWord: "session started: ", meta: "/work/app · kanban app", category: "sessions" });
	});

	it("counts rows per category, a file group under files", () => {
		expect(modelOf({ events: ONE_SESSION }).counts).toEqual({ sessions: 1, phases: 2, files: 1 });
	});

	it("tags nothing and lists no sessions while one session is shown", () => {
		const { rows, sessions } = modelOf({ events: ONE_SESSION });
		expect(sessions).toEqual([]);
		expect(rows.every((row) => row.sessionTag === null)).toBe(true);
	});

	it("shows only the focused session when the project lists it, running or ended", () => {
		const events = [
			event({ kind: "prompt", seq: 1, text: "old", sessionId: "old", ts: local({ hour: 9, minute: 0 }) }),
			event({ kind: "prompt", seq: 1, text: "now", sessionId: "s1", ts: local({ hour: 14, minute: 0 }) }),
		];
		const sessions = [
			session({ sessionId: "old", startedAt: local({ hour: 9, minute: 0 }), liveness: makeLiveness({ state: "ended" }) }),
			session({ sessionId: "s1", startedAt: local({ hour: 14, minute: 0 }), liveness: makeLiveness() }),
		];
		expect(modelOf({ events, sessions, focus: "old" }).rows.map((row) => row.label)).toEqual(["Prompt: “old”"]);
		expect(modelOf({ events, sessions, focus: "s1" }).rows.map((row) => row.label)).toEqual(["Prompt: “now”"]);
		expect(modelOf({ events, sessions, focus: "s1" }).sessions).toEqual([]);
	});

	it("merges two running sessions by time when the focused one is not listed, tagging each row with its session's start and listing the sessions oldest first", () => {
		const events = [
			event({ kind: "prompt", seq: 1, text: "second", sessionId: "b", ts: local({ hour: 15, minute: 31 }) }),
			event({ kind: "prompt", seq: 1, text: "first", sessionId: "a", ts: local({ hour: 14, minute: 3 }) }),
		];
		const sessions = [
			session({ sessionId: "b", startedAt: local({ hour: 15, minute: 30 }), liveness: makeLiveness() }),
			session({ sessionId: "a", startedAt: local({ hour: 14, minute: 2 }), liveness: makeLiveness({ minutesQuiet: 20 }) }),
		];
		const model = modelOf({ events, sessions, focus: "unlisted" });

		expect(model.rows.map((row) => [row.label, row.sessionTag])).toEqual([
			["Prompt: “first”", "14:02"],
			["Prompt: “second”", "15:30"],
		]);
		expect(model.sessions).toEqual([
			{ id: "a", label: "14:02" },
			{ id: "b", label: "15:30" },
		]);
	});

	it("reads the project's whole event list for earlier task events, whichever session they are in", () => {
		const events = [
			event({ kind: "task", seq: 1, slug: "t", action: "picked", column: "Todo", sessionId: "old", ts: local({ hour: 9, minute: 0 }) }),
			event({ kind: "task", seq: 1, slug: "t", action: "moved", column: "Done", ts: local({ hour: 14, minute: 0 }) }),
		];
		const sessions = [session({ sessionId: "s1", startedAt: local({ hour: 14, minute: 0 }), liveness: makeLiveness() })];
		expect(modelOf({ events, sessions }).rows[0]?.meta).toBe("Todo → Done");
	});

	it("words the pipeline events as pipeline and skip rows, counted under phases, beside v1 rows unchanged", () => {
		const events = [
			event({ kind: "pipeline_started", seq: 1, pipeline: "p1", phase: "build", ts: local({ hour: 14, minute: 0 }) }),
			event({ kind: "phase_skipped", seq: 2, pipeline: "p1", phase: "research", reason: "nothing new", ts: local({ hour: 14, minute: 1 }) }),
			event({ kind: "phase_started", seq: 3, pipeline: "p1", phase: "build", agent: "a", module: "src/a", ts: local({ hour: 14, minute: 2 }) }),
			event({ kind: "pipeline_finished", seq: 4, pipeline: "p1", result: "abandoned", ts: local({ hour: 14, minute: 3 }) }),
		];
		const { rows, counts } = modelOf({ events });

		expect(rows.map((row) => [row.kind, row.category, row.icon, row.kindWord, row.label, row.meta])).toEqual([
			["pipeline", "phases", "loop", "pipeline: ", "Pipeline p1 started at Build", null],
			["skip", "phases", "todo", "skipped: ", "Research skipped", "nothing new"],
			["phase", "phases", "flag", "phase started: ", "Build started", "a · src/a"],
			["pipeline", "phases", "loop", "pipeline: ", "Pipeline p1 abandoned", null],
		]);
		expect(counts).toEqual({ phases: 4 });
	});

	it("is empty with no event", () => {
		expect(modelOf({ events: [] })).toEqual({ rows: [], total: 0, sessions: [], counts: {} });
	});

	it("gives each row an id from its session and seq, and the item a click opens", () => {
		const { rows } = modelOf({ events: ONE_SESSION });
		expect(rows.map((row) => row.id)).toEqual(["s1:1", "s1:2", "s1:5"]);
		expect(rows.map((row) => row.item)).toEqual([
			{ kind: "event", sessionId: "s1", seq: 1 },
			{ kind: "module", folder: "src/a" },
			{ kind: "module", folder: "src/a" },
		]);
	});
});
