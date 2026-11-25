import { describe, expect, it } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import formatClock from "@/observer/page/shared/formatClock/index.js";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import NOW from "@/observer/page/__fixtures__/NOW/index.js";
import buildEventDrawer from "./index.js";

const clock = (iso: string): string => formatClock({ iso, now: NOW }).clock;
const T = (minutes: string): string => `2026-11-23T14:${minutes}:00.000Z`;

function drawerOf({ events, seq, todoText = null }: { events: ObserverEvent[]; seq: number; todoText?: string | null }) {
	const event = events.find((candidate) => candidate.seq === seq)!;
	return buildEventDrawer({ event, context: makeContext({ events }), todoText });
}

describe("buildEventDrawer", () => {
	it("draws a prompt: its time in the kind, the first line as title, the session start as meta, the whole text as one block", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("02"), kind: "session_started" }),
			makeEvent({ seq: 2, ts: T("03"), kind: "prompt", text: "Pick up the next p1.\n\nIf the spec is misaligned, fix it first." }),
		];
		expect(drawerOf({ events, seq: 2 })).toEqual({
			kind: `Prompt · ${clock(T("03"))}`,
			title: "Pick up the next p1.",
			titleMono: false,
			meta: `session ${clock(T("02"))}`,
			blocks: [{ heading: "Full text", icon: "prompt", badge: null, type: "pre", text: "Pick up the next p1.\n\nIf the spec is misaligned, fix it first." }],
		});
	});

	it("draws a commit: short sha, time and the phase that was running, the message", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("10"), kind: "phase_started", phase: "build", agent: "aide-implementor", module: "src/a" }),
			makeEvent({ seq: 2, ts: T("29"), kind: "commit", sha: "414776f0a1b2", message: "score: add weights\n\nBody." }),
		];
		expect(drawerOf({ events, seq: 2 })).toEqual({
			kind: "Commit",
			title: "414776f",
			titleMono: true,
			meta: `${clock(T("29"))} · during Build`,
			blocks: [{ heading: "Message", icon: "commit", badge: null, type: "pre", text: "score: add weights\n\nBody." }],
		});
	});

	it("leaves out during when no phase was running, and says when a commit has no message", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("10"), kind: "phase_started", phase: "build", agent: "a", module: "src/a" }),
			makeEvent({ seq: 2, ts: T("11"), kind: "phase_finished", phase: "build", agent: "a", module: "src/a" }),
			makeEvent({ seq: 3, ts: T("12"), kind: "commit", sha: "abcdef1" }),
		];
		expect(drawerOf({ events, seq: 3 })).toMatchObject({
			meta: clock(T("12")),
			blocks: [{ type: "pre", text: "No message reported." }],
		});
	});

	it("draws a finished phase: title, agent and span, summary, and the files written after it", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("14"), kind: "phase_started", phase: "plan", agent: "aide-architect", module: "/work/app/src/tools/score" }),
			makeEvent({ seq: 2, ts: "2026-11-23T14:17:41.000Z", kind: "phase_finished", phase: "plan", agent: "aide-architect", module: "/work/app/src/tools/score", summary: "Wrote plan.aide with 9 steps." }),
			makeEvent({ seq: 3, ts: "2026-11-23T14:17:42.000Z", kind: "file_written", path: "/work/app/src/tools/score/plan.aide", action: "created" }),
			makeEvent({ seq: 4, ts: "2026-11-23T14:17:43.000Z", kind: "file_written", path: "src/tools/score/brief.aide", action: "updated" }),
			makeEvent({ seq: 5, ts: "2026-11-23T14:20:00.000Z", kind: "prompt", text: "x" }),
		];
		const drawer = drawerOf({ events, seq: 2 })!;
		expect(drawer.kind).toBe("Phase finished");
		expect(drawer.title).toBe("Plan · src/tools/score");
		expect(drawer.meta).toBe(`aide-architect · ${clock(T("14"))} → ${clock("2026-11-23T14:17:41.000Z")} · 3m 41s`);
		expect(drawer.blocks).toEqual([
			{ heading: "Summary", icon: "done", badge: null, type: "text", paras: ["Wrote plan.aide with 9 steps."] },
			{
				heading: "Files written",
				icon: "files",
				badge: null,
				type: "kv",
				rows: [
					{ key: "created", value: "src/tools/score/plan.aide", mono: true },
					{ key: "updated", value: "src/tools/score/brief.aide", mono: true },
				],
			},
		]);
	});

	it("states just the end time of a phase that has no recorded start, and no blocks when there is no summary or file", () => {
		const events = [makeEvent({ seq: 1, ts: T("18"), kind: "phase_finished", phase: "qa", agent: "aide-qa", module: "src/a" })];
		expect(drawerOf({ events, seq: 1 })).toMatchObject({ meta: `aide-qa · ${clock(T("18"))}`, blocks: [] });
	});

	it("draws a QA verdict with issues: count and round in the title, module and time as meta, the module's todo issues", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("30"), kind: "qa_verdict", module: "src/a", verdict: "issues", open: 3 }),
			makeEvent({ seq: 2, ts: T("48"), kind: "qa_verdict", module: "src/a", verdict: "issues", open: 2 }),
		];
		const drawer = drawerOf({ events, seq: 2, todoText: "- [ ] **a.ts:1** — broken\n- [x] **b.ts:2** — fixed\n\n## Retro\n\n- lesson\n" })!;
		expect(drawer).toMatchObject({ kind: "QA verdict", title: "2 issues open · round 2", meta: `src/a · ${clock(T("48"))}` });
		expect(drawer.blocks).toHaveLength(1);
		expect(drawer.blocks[0]).toMatchObject({ heading: "Issues", badge: { text: "1 of 2 open", tone: "danger" } });
	});

	it("words a single issue, an unreported count and a pass", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("30"), kind: "qa_verdict", module: "src/a", verdict: "issues", open: 1 }),
			makeEvent({ seq: 2, ts: T("31"), kind: "qa_verdict", module: "src/a", verdict: "issues" }),
			makeEvent({ seq: 3, ts: T("32"), kind: "qa_verdict", module: "src/a", verdict: "passed" }),
		];
		expect(drawerOf({ events, seq: 1 })!.title).toBe("1 issue open · round 1");
		expect(drawerOf({ events, seq: 2 })!.title).toBe("Issues open · round 2");
		expect(drawerOf({ events, seq: 3 })!.title).toBe("Passed");
		expect(drawerOf({ events, seq: 3 })!.blocks).toEqual([]);
	});

	it("draws an error: first line as title, agent, module and time, the whole message", () => {
		const events = [
			makeEvent({ seq: 1, ts: T("47"), kind: "error", message: "rank.test.ts timed out after 30s\n  at rank.test.ts:118", agent: "aide-qa", module: "/work/app/src/tools/score" }),
		];
		expect(drawerOf({ events, seq: 1 })).toEqual({
			kind: "Error",
			title: "rank.test.ts timed out after 30s",
			titleMono: false,
			meta: `aide-qa · src/tools/score · ${clock(T("47"))}`,
			blocks: [{ heading: "Message", icon: "error", badge: null, type: "pre", text: "rank.test.ts timed out after 30s\n  at rank.test.ts:118" }],
		});
	});

	it("draws a session start with what it reported, each field only when reported", () => {
		const events = [makeEvent({ seq: 1, ts: T("02"), kind: "session_started", projectRoot: "/work/app", kanbanTag: "aidemd" })];
		expect(drawerOf({ events, seq: 1 })).toEqual({
			kind: "Session started",
			title: `Session ${clock(T("02"))}`,
			titleMono: false,
			meta: null,
			blocks: [
				{
					heading: "Reported",
					icon: "power",
					badge: null,
					type: "kv",
					rows: [
						{ key: "Project root", value: "/work/app", mono: true },
						{ key: "Kanban tag", value: "aidemd", mono: true },
					],
				},
			],
		});
	});

	it("has no Reported block for a session start that reported nothing", () => {
		expect(drawerOf({ events: [makeEvent({ seq: 1, ts: T("02"), kind: "session_started" })], seq: 1 })!.blocks).toEqual([]);
	});

	it("draws a release: the version as a mono title and the time", () => {
		const events = [makeEvent({ seq: 1, ts: T("55"), kind: "release", version: "0.15.1" })];
		expect(drawerOf({ events, seq: 1 })).toEqual({ kind: "Release", title: "0.15.1", titleMono: true, meta: clock(T("55")), blocks: [] });
	});

	it("is null for events the history opens as something else", () => {
		const events = [makeEvent({ seq: 1, ts: T("55"), kind: "task", slug: "s", action: "picked" })];
		expect(drawerOf({ events, seq: 1 })).toBeNull();
	});

	it("reads a project root the status reports when it relativises module paths", () => {
		const events = [makeEvent({ seq: 1, ts: T("47"), kind: "error", message: "x", module: "/other/src/a" })];
		const event = events[0]!;
		const context = makeContext({ status: makeStatus({ projectRoot: "/other" }), events });
		expect(buildEventDrawer({ event, context, todoText: null })!.meta).toBe(`src/a · ${clock(T("47"))}`);
	});
});
