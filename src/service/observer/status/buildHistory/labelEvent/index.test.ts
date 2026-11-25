import { describe, it, expect } from "vitest";
import type { ObserverEvent } from "@/types/index.js";
import labelEvent from "./index.js";

function makeEvent(fields: Record<string, unknown> & { kind: ObserverEvent["kind"] }): ObserverEvent {
	return {
		v: 1,
		ts: "2026-11-22T10:04:12.000Z",
		sessionId: "s1",
		seq: 1,
		pid: 100,
		...fields,
	} as ObserverEvent;
}

describe("labelEvent — one label per kind", () => {
	it.each([
		["session_started", { kind: "session_started" }, "Session started"],
		["prompt", { kind: "prompt", text: "Fix the tree" }, 'You: "Fix the tree"'],
		["task picked", { kind: "task", slug: "fix-tree", title: "Fix the tree", action: "picked" }, "Task picked: Fix the tree"],
		["task picked without title", { kind: "task", slug: "fix-tree", action: "picked" }, "Task picked: fix-tree"],
		["task moved", { kind: "task", slug: "fix-tree", title: "Fix the tree", action: "moved", column: "Done" }, "Task: Fix the tree → Done"],
		["task moved without column", { kind: "task", slug: "fix-tree", action: "moved" }, "Task: fix-tree"],
		["pipeline_started", { kind: "pipeline_started", pipeline: "observer-v3", phase: "build" }, "Pipeline observer-v3 started at Build"],
		["pipeline_finished completed", { kind: "pipeline_finished", pipeline: "observer-v3", result: "completed" }, "Pipeline observer-v3 completed"],
		["pipeline_finished abandoned", { kind: "pipeline_finished", pipeline: "observer-v3", result: "abandoned" }, "Pipeline observer-v3 abandoned"],
		["phase_skipped", { kind: "phase_skipped", pipeline: "observer-v3", phase: "research", reason: "no new domain" }, "Research skipped"],
		["phase_started", { kind: "phase_started", phase: "qa", agent: "aide-qa", module: "src/a" }, "QA · aide-qa · src/a"],
		["phase_finished", { kind: "phase_finished", phase: "plan", agent: "aide-architect", module: "src/a" }, "Plan done"],
		["phase_finished with result", { kind: "phase_finished", phase: "build", agent: "x", module: "src/a", result: "passed" }, "Build done · passed"],
		["gate_waiting", { kind: "gate_waiting", gate: "plan approval", file: "src/a/plan.aide" }, "Waiting on you: plan.aide"],
		["gate_resolved", { kind: "gate_resolved", gate: "plan approval", file: "src/a/plan.aide" }, "plan approval resolved"],
		["gate_resolved with resolution", { kind: "gate_resolved", gate: "plan approval", file: "src/a/plan.aide", resolution: "approved" }, "plan approval resolved · approved"],
		["plan_step_checked", { kind: "plan_step_checked", module: "src/a", step: "4", total: 9 }, "Build step 4/9 ✓"],
		["plan_step_checked without total", { kind: "plan_step_checked", module: "src/a", step: "4" }, "Build step 4 ✓"],
		["qa_verdict passed", { kind: "qa_verdict", module: "src/a", verdict: "passed" }, "QA passed"],
		["qa_verdict issues", { kind: "qa_verdict", module: "src/a", verdict: "issues", open: 3 }, "QA: 3 issues → todo.aide"],
		["qa_verdict issues without open", { kind: "qa_verdict", module: "src/a", verdict: "issues" }, "QA: issues → todo.aide"],
		["file_written", { kind: "file_written", path: "src/a/plan.aide", action: "created" }, "plan.aide created"],
		["commit", { kind: "commit", sha: "abcdef0123456789" }, "Committed abcdef0"],
		["release", { kind: "release", version: "0.16.0" }, "Released 0.16.0"],
		["error with agent", { kind: "error", message: "boom", agent: "aide-implementor" }, "aide-implementor failed"],
		["error without agent", { kind: "error", message: "boom" }, "Error"],
	] as const)("%s", (_name, fields, label) => {
		expect(labelEvent({ event: makeEvent({ ...fields }) }).label).toBe(label);
	});
});

describe("labelEvent — detail", () => {
	it("keeps all lines of a multi-line prompt in the detail and only the first in the label", () => {
		const text = "first line\nsecond line\n  third line  ";
		const row = labelEvent({ event: makeEvent({ kind: "prompt", text }) });

		expect(row.label).toBe('You: "first line…"');
		expect(row.detail).toEqual({ text });
	});

	it("trims the first line of a prompt", () => {
		expect(labelEvent({ event: makeEvent({ kind: "prompt", text: "  hello  " }) }).label).toBe('You: "hello"');
	});

	it.each([
		["leading blank lines", "\n\n  Fix the bug\nmore", 'You: "Fix the bug…"'],
		["trailing blank lines", "hello\n\n", 'You: "hello"'],
		["CRLF with a blank line between", "a\r\n\r\nb", 'You: "a…"'],
		["a single line", "one line", 'You: "one line"'],
		["only blank lines", "  \n\t\n", 'You: ""'],
	])("labels a prompt with %s by its first non-blank line", (_name, text, label) => {
		const row = labelEvent({ event: makeEvent({ kind: "prompt", text }) });

		expect(row.label).toBe(label);
		expect(row.detail).toEqual({ text });
	});

	it("gives a passed QA verdict no detail", () => {
		const row = labelEvent({ event: makeEvent({ kind: "qa_verdict", module: "src/a", verdict: "passed" }) });

		expect(row).toEqual({ label: "QA passed" });
		expect(row.detail).toBeUndefined();
	});

	it("points an issues QA verdict at the module's todo", () => {
		const row = labelEvent({
			event: makeEvent({ kind: "qa_verdict", module: "src/a", verdict: "issues", open: 3 }),
		});

		expect(row.label).toBe("QA: 3 issues → todo.aide");
		expect(row.detail).toEqual({ file: "src/a/todo.aide" });
	});

	it("carries a skipped phase's reason as detail", () => {
		const row = labelEvent({
			event: makeEvent({ kind: "phase_skipped", pipeline: "p", phase: "research", reason: "no new domain" }),
		});

		expect(row.detail).toEqual({ text: "no new domain" });
	});

	it("gives pipeline start and finish no detail", () => {
		expect(labelEvent({ event: makeEvent({ kind: "pipeline_started", pipeline: "p", phase: "spec" }) }).detail).toBeUndefined();
		expect(
			labelEvent({ event: makeEvent({ kind: "pipeline_finished", pipeline: "p", result: "completed" }) }).detail,
		).toBeUndefined();
	});

	it("lists the reported session fields that are present", () => {
		const row = labelEvent({
			event: makeEvent({ kind: "session_started", projectRoot: "/p", kanbanTag: "tag" }),
		});

		expect(row.detail).toEqual({ text: "Project root: /p\nKanban tag: tag" });
	});

	it("carries the task slug, the file and the message as detail", () => {
		expect(labelEvent({ event: makeEvent({ kind: "task", slug: "s", action: "picked" }) }).detail).toEqual({ slug: "s" });
		expect(
			labelEvent({ event: makeEvent({ kind: "gate_waiting", gate: "g", file: "src/a/plan.aide" }) }).detail,
		).toEqual({ file: "src/a/plan.aide" });
		expect(labelEvent({ event: makeEvent({ kind: "commit", sha: "abcdef0", message: "msg" }) }).detail).toEqual({
			text: "msg",
		});
		expect(labelEvent({ event: makeEvent({ kind: "error", message: "boom" }) }).detail).toEqual({ text: "boom" });
		expect(
			labelEvent({ event: makeEvent({ kind: "qa_verdict", module: "src/a", verdict: "issues" }) }).detail,
		).toEqual({ file: "src/a/todo.aide" });
	});
});

describe("labelEvent — phase_finished duration", () => {
	const event = makeEvent({
		kind: "phase_finished",
		phase: "qa",
		agent: "aide-qa",
		module: "src/a",
		result: "passed",
		summary: "all green",
	});

	it("shows the duration since startedAt when given", () => {
		const row = labelEvent({ event, startedAt: "2026-11-22T10:00:00.000Z" });

		expect(row.label).toBe("QA done · 4m 12s · passed");
		expect(row.detail).toEqual({ text: "all green" });
	});

	it("omits the duration when startedAt is absent", () => {
		expect(labelEvent({ event }).label).toBe("QA done · passed");
	});
});
