import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import type { ObserverEvent } from "@/types/index.js";
import type { ModuleNode, TreeFileEntry } from "../types/index.js";
import findWaitingFiles from "./index.js";

const PROJECT_ROOT = resolve("/tmp/waiting-project");
const T0 = Date.parse("2026-11-22T10:00:00.000Z");

function iso(minutes: number): string {
	return new Date(T0 + minutes * 60 * 1000).toISOString();
}

function makeGateEvent(
	kind: "gate_waiting" | "gate_resolved",
	file: string,
	{ sessionId = "s1", seq = 1, minutes = 0, gate = "plan-approval" } = {},
): ObserverEvent {
	return { v: 1, ts: iso(minutes), sessionId, seq, pid: 100, kind, gate, file } as ObserverEvent;
}

const progress = { done: 0, total: 0, open: 0 };

function makeWorkEntry(
	file: string,
	kind: "plan" | "todo" | "brief",
	status: "proposed" | "approved" | "unset" = "proposed",
): TreeFileEntry {
	const folder = file.split("/").slice(0, -1).join("/") || ".";
	return {
		kind,
		file,
		folder,
		read: {
			state: "present",
			status,
			awaitingApproval: status === "proposed",
			progress,
			steps: { done: 0, total: 0 },
		},
	};
}

function makeIntentEntry(file: string): TreeFileEntry {
	const folder = file.endsWith("/.aide") ? file.slice(0, -"/.aide".length) : ".";
	return {
		kind: "intent",
		file,
		folder,
		read: { state: "present", alignment: "unset", description: "", progress },
	};
}

function makeMalformedEntry(file: string, kind: "plan" | "todo" | "brief"): TreeFileEntry {
	const folder = file.split("/").slice(0, -1).join("/") || ".";
	return { kind, file, folder, read: { state: "malformed", error: "bad yaml" } };
}

function makeOtherEntry(file: string, kind: "session" | "research"): TreeFileEntry {
	const folder = file.split("/").slice(0, -1).join("/") || ".";
	return { kind, file, folder, read: { state: "present", progress } };
}

function makeNodes(files: TreeFileEntry[]): ModuleNode[] {
	return [{ folder: ".", parent: null, files }];
}

describe("findWaitingFiles", () => {
	it("lists a proposed plan named by a gate_waiting event", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);
		const events = [makeGateEvent("gate_waiting", "src/a/plan.aide", { minutes: 5 })];

		const waiting = findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes });

		expect(waiting).toEqual([
			{
				file: "src/a/plan.aide",
				folder: "src/a",
				kind: "plan",
				gate: "plan-approval",
				sessionId: "s1",
				seq: 1,
				since: iso(5),
			},
		]);
	});

	it("shows nothing once the plan was approved without a gate_resolved", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan", "approved")]);
		const events = [makeGateEvent("gate_waiting", "src/a/plan.aide")];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toEqual([]);
	});

	it("shows nothing when a later gate_resolved names the still-proposed plan", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);
		const events = [
			makeGateEvent("gate_waiting", "src/a/plan.aide", { seq: 1 }),
			makeGateEvent("gate_resolved", "src/a/plan.aide", { seq: 2 }),
		];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toEqual([]);
	});

	it("is not cleared by a gate_resolved from another session with an earlier ts", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);
		const events = [
			makeGateEvent("gate_waiting", "src/a/plan.aide", { sessionId: "s1", seq: 1, minutes: 10 }),
			makeGateEvent("gate_resolved", "src/a/plan.aide", { sessionId: "s2", seq: 9, minutes: 5 }),
		];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toHaveLength(1);
	});

	it("is cleared by a gate_resolved from another session with a strictly later ts", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);
		const events = [
			makeGateEvent("gate_waiting", "src/a/plan.aide", { sessionId: "s1", seq: 5, minutes: 10 }),
			makeGateEvent("gate_resolved", "src/a/plan.aide", { sessionId: "s2", seq: 1, minutes: 11 }),
		];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toEqual([]);
	});

	it("is not cleared by a gate_resolved in the same session with a lower seq", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);
		const events = [
			makeGateEvent("gate_waiting", "src/a/plan.aide", { seq: 4, minutes: 1 }),
			makeGateEvent("gate_resolved", "src/a/plan.aide", { seq: 2, minutes: 9 }),
		];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toHaveLength(1);
	});

	it("shows nothing for a proposed plan with no gate_waiting event", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events: [], nodes })).toEqual([]);
	});

	it.each([
		["proposed", 1],
		["approved", 0],
	] as const)("a brief that is %s yields %i waiting file(s)", (status, count) => {
		const nodes = makeNodes([makeWorkEntry("src/a/brief.aide", "brief", status)]);
		const events = [makeGateEvent("gate_waiting", "src/a/brief.aide")];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toHaveLength(count);
	});

	it("waits on an intent spec while the file exists and stops once it is deleted", () => {
		const events = [makeGateEvent("gate_waiting", "src/a/.aide", { gate: "spec-approval" })];

		const present = findWaitingFiles({
			projectRoot: PROJECT_ROOT,
			events,
			nodes: makeNodes([makeIntentEntry("src/a/.aide")]),
		});
		const deleted = findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes: makeNodes([]) });

		expect(present).toHaveLength(1);
		expect(present[0]).toMatchObject({ kind: "intent", folder: "src/a", gate: "spec-approval" });
		expect(deleted).toEqual([]);
	});

	it.each([
		["a file that does not exist", "src/missing/plan.aide"],
		["a file outside the project", "../elsewhere/plan.aide"],
		["the session record", ".aide/session.aide"],
		["a research file", "src/a/research.aide"],
	])("shows nothing for %s", (_label, file) => {
		const nodes = makeNodes([
			makeOtherEntry(".aide/session.aide", "session"),
			makeOtherEntry("src/a/research.aide", "research"),
		]);
		const events = [makeGateEvent("gate_waiting", file)];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toEqual([]);
	});

	it("shows nothing for a malformed plan", () => {
		const nodes = makeNodes([makeMalformedEntry("src/a/plan.aide", "plan")]);
		const events = [makeGateEvent("gate_waiting", "src/a/plan.aide")];

		expect(findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes })).toEqual([]);
	});

	it("orders two proposed files newest first, and the older takes over when the newest is approved", () => {
		const events = [
			makeGateEvent("gate_waiting", "src/a/plan.aide", { seq: 1, minutes: 1 }),
			makeGateEvent("gate_waiting", "src/b/plan.aide", { seq: 2, minutes: 2 }),
		];

		const both = findWaitingFiles({
			projectRoot: PROJECT_ROOT,
			events,
			nodes: makeNodes([makeWorkEntry("src/a/plan.aide", "plan"), makeWorkEntry("src/b/plan.aide", "plan")]),
		});
		const newestApproved = findWaitingFiles({
			projectRoot: PROJECT_ROOT,
			events,
			nodes: makeNodes([
				makeWorkEntry("src/a/plan.aide", "plan"),
				makeWorkEntry("src/b/plan.aide", "plan", "approved"),
			]),
		});

		expect(both.map((entry) => entry.file)).toEqual(["src/b/plan.aide", "src/a/plan.aide"]);
		expect(newestApproved.map((entry) => entry.file)).toEqual(["src/a/plan.aide"]);
	});

	it("breaks a ts tie by seq within a session, otherwise by sessionId descending", () => {
		const nodes = makeNodes([
			makeWorkEntry("src/a/plan.aide", "plan"),
			makeWorkEntry("src/b/plan.aide", "plan"),
			makeWorkEntry("src/c/plan.aide", "plan"),
		]);
		const events = [
			makeGateEvent("gate_waiting", "src/a/plan.aide", { sessionId: "s1", seq: 1 }),
			makeGateEvent("gate_waiting", "src/b/plan.aide", { sessionId: "s1", seq: 2 }),
			makeGateEvent("gate_waiting", "src/c/plan.aide", { sessionId: "s2", seq: 1 }),
		];

		const waiting = findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes });

		expect(waiting.map((entry) => entry.file)).toEqual(["src/c/plan.aide", "src/b/plan.aide", "src/a/plan.aide"]);
	});

	it("collapses the absolute and relative forms of one file to a single entry with the latest since", () => {
		const nodes = makeNodes([makeWorkEntry("src/a/plan.aide", "plan")]);
		const events = [
			makeGateEvent("gate_waiting", "./src/a/plan.aide", { seq: 1, minutes: 1 }),
			makeGateEvent("gate_waiting", resolve(PROJECT_ROOT, "src/a/plan.aide"), { seq: 2, minutes: 7 }),
		];

		const waiting = findWaitingFiles({ projectRoot: PROJECT_ROOT, events, nodes });

		expect(waiting).toHaveLength(1);
		expect(waiting[0]).toMatchObject({ file: "src/a/plan.aide", since: iso(7), seq: 2 });
	});
});
