import { describe, expect, it } from "vitest";
import makeContext from "@/observer/page/__fixtures__/makeContext/index.js";
import makeEvent from "@/observer/page/__fixtures__/makeEvent/index.js";
import makeFile from "@/observer/page/__fixtures__/makeFile/index.js";
import makeStatus from "@/observer/page/__fixtures__/makeStatus/index.js";
import SCORE_NODE from "@/observer/page/__fixtures__/SCORE_NODE/index.js";
import planDrawerFetch from "./index.js";

const WITH_TREE = makeContext({ status: makeStatus({ tree: [SCORE_NODE] }) });
const ALL_THREE = [
	{ role: "spec", path: "src/tools/score/.aide" },
	{ role: "plan", path: "src/tools/score/plan.aide" },
	{ role: "todo", path: "src/tools/score/todo.aide" },
];

describe("planDrawerFetch", () => {
	it("reads a module's spec, plan and todo that the tree lists", () => {
		expect(planDrawerFetch({ item: { kind: "module", folder: "src/tools/score" }, context: WITH_TREE })).toEqual({ type: "files", files: ALL_THREE });
	});

	it("reads only the files a module lists", () => {
		const context = makeContext({
			status: makeStatus({ tree: [{ folder: "src/b", parent: null, files: [makeFile({ kind: "plan", folder: "src/b", file: "src/b/plan.aide" })] }] }),
		});
		expect(planDrawerFetch({ item: { kind: "module", folder: "src/b" }, context })).toEqual({ type: "files", files: [{ role: "plan", path: "src/b/plan.aide" }] });
	});

	it("reads nothing for a module the tree does not list", () => {
		expect(planDrawerFetch({ item: { kind: "module", folder: "src/none" }, context: WITH_TREE })).toEqual({ type: "none" });
		expect(planDrawerFetch({ item: { kind: "module", folder: "src/tools/score" }, context: makeContext({ status: null }) })).toEqual({ type: "none" });
	});

	it.each(["src/tools/score/plan.aide", "src/tools/score/todo.aide", "src/tools/score/.aide"])("reads the module of %s", (path) => {
		expect(planDrawerFetch({ item: { kind: "file", path }, context: WITH_TREE })).toEqual({ type: "files", files: ALL_THREE });
	});

	it("reads an opened brief beside the module's files", () => {
		const context = makeContext({
			status: makeStatus({
				tree: [{ ...SCORE_NODE, files: [...SCORE_NODE.files, makeFile({ kind: "brief", folder: "src/tools/score", file: "src/tools/score/brief.aide" })] }],
			}),
		});
		expect(planDrawerFetch({ item: { kind: "file", path: "src/tools/score/brief.aide" }, context })).toEqual({
			type: "files",
			files: [...ALL_THREE, { role: "brief", path: "src/tools/score/brief.aide" }],
		});
	});

	it("reads an opened AIDE file even when no tree lists its module", () => {
		expect(planDrawerFetch({ item: { kind: "file", path: "src/new/plan.aide" }, context: makeContext({ status: null }) })).toEqual({
			type: "files",
			files: [{ role: "plan", path: "src/new/plan.aide" }],
		});
	});

	it("reads any other file by itself", () => {
		expect(planDrawerFetch({ item: { kind: "file", path: "src/a/index.ts" }, context: WITH_TREE })).toEqual({
			type: "files",
			files: [{ role: "file", path: "src/a/index.ts" }],
		});
	});

	it("reads a task by its slug", () => {
		expect(planDrawerFetch({ item: { kind: "task", slug: "fix-it" }, context: WITH_TREE })).toEqual({ type: "task", slug: "fix-it" });
	});

	it("reads a QA verdict's module todo, and no other event anything", () => {
		const events = [
			makeEvent({ seq: 1, ts: "2026-11-23T14:00:00.000Z", kind: "qa_verdict", module: "/work/app/src/tools/score", verdict: "issues", open: 2 }),
			makeEvent({ seq: 2, ts: "2026-11-23T14:01:00.000Z", kind: "prompt", text: "hi" }),
		];
		const context = makeContext({ status: makeStatus({ tree: [SCORE_NODE] }), events });
		expect(planDrawerFetch({ item: { kind: "event", sessionId: "s1", seq: 1 }, context })).toEqual({
			type: "files",
			files: [{ role: "todo", path: "src/tools/score/todo.aide" }],
		});
		expect(planDrawerFetch({ item: { kind: "event", sessionId: "s1", seq: 2 }, context })).toEqual({ type: "none" });
		expect(planDrawerFetch({ item: { kind: "event", sessionId: "s1", seq: 99 }, context })).toEqual({ type: "none" });
	});
});
