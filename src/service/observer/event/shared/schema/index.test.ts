import { describe, it, expect } from "vitest";
import {
	inputSchema,
	schema,
	SCHEMA_VERSION,
} from "@/service/observer/event/shared/schema/index.js";

const ENVELOPE = {
	v: 1,
	ts: "2026-11-22T10:00:00.000Z",
	sessionId: "20261122T100000000Z-abc123",
	seq: 1,
	pid: 4242,
};

/** Minimal valid agent input per kind. */
const MINIMAL: Record<string, Record<string, unknown>> = {
	session_started: { kind: "session_started" },
	prompt: { kind: "prompt", text: "do the thing" },
	task: { kind: "task", slug: "a-task", action: "picked" },
	phase_started: { kind: "phase_started", phase: "build", agent: "implementor", module: "src/x" },
	phase_finished: { kind: "phase_finished", phase: "qa", agent: "aide-qa", module: "src/x" },
	gate_waiting: { kind: "gate_waiting", gate: "plan", file: "src/x/plan.aide" },
	gate_resolved: { kind: "gate_resolved", gate: "plan", file: "src/x/plan.aide" },
	plan_step_checked: { kind: "plan_step_checked", module: "src/x", step: "3a" },
	qa_verdict: { kind: "qa_verdict", module: "src/x", verdict: "passed" },
	file_written: { kind: "file_written", path: "src/x/index.ts", action: "created" },
	commit: { kind: "commit", sha: "abc1234" },
	release: { kind: "release", version: "0.16.0" },
	error: { kind: "error", message: "boom" },
};

const KINDS = Object.keys(MINIMAL);

/** Required fields per kind (everything except `kind`) that can be dropped. */
const REQUIRED: Array<[string, string]> = [
	["prompt", "text"],
	["task", "slug"],
	["task", "action"],
	["phase_started", "phase"],
	["phase_started", "agent"],
	["phase_started", "module"],
	["phase_finished", "phase"],
	["phase_finished", "agent"],
	["phase_finished", "module"],
	["gate_waiting", "gate"],
	["gate_waiting", "file"],
	["gate_resolved", "gate"],
	["gate_resolved", "file"],
	["plan_step_checked", "module"],
	["plan_step_checked", "step"],
	["qa_verdict", "module"],
	["qa_verdict", "verdict"],
	["file_written", "path"],
	["file_written", "action"],
	["commit", "sha"],
	["release", "version"],
	["error", "message"],
];

function makeStored(kind: string, overrides: Record<string, unknown> = {}) {
	return { ...ENVELOPE, ...MINIMAL[kind], ...overrides };
}

describe("shared/schema", () => {
	it("exports SCHEMA_VERSION 1", () => {
		expect(SCHEMA_VERSION).toBe(1);
	});

	it.each(KINDS)("%s: minimal input parses with inputSchema and stamped with schema", (kind) => {
		expect(inputSchema.safeParse(MINIMAL[kind]).success).toBe(true);
		expect(schema.safeParse(makeStored(kind)).success).toBe(true);
	});

	it.each(REQUIRED)("%s: missing %s is rejected", (kind, field) => {
		const input = { ...MINIMAL[kind] };
		delete input[field];
		expect(inputSchema.safeParse(input).success).toBe(false);
		expect(schema.safeParse({ ...ENVELOPE, ...input }).success).toBe(false);
	});

	it("rejects an unknown kind", () => {
		expect(inputSchema.safeParse({ kind: "nope" }).success).toBe(false);
		expect(schema.safeParse({ ...ENVELOPE, kind: "nope" }).success).toBe(false);
	});

	it.each(KINDS)("%s: an extra key is rejected by both schemas", (kind) => {
		expect(inputSchema.safeParse({ ...MINIMAL[kind], extra: 1 }).success).toBe(false);
		expect(schema.safeParse(makeStored(kind, { extra: 1 })).success).toBe(false);
	});

	it.each(["ts", "seq", "sessionId", "pid", "v"])(
		"inputSchema rejects an input carrying %s",
		(key) => {
			const value = (ENVELOPE as Record<string, unknown>)[key];
			expect(inputSchema.safeParse({ ...MINIMAL.prompt, [key]: value }).success).toBe(false);
		},
	);

	it.each([
		["v: 2", { v: 2 }],
		["seq: 0", { seq: 0 }],
		["seq: 1.5", { seq: 1.5 }],
		["a non-ISO ts", { ts: "yesterday" }],
		["a sessionId of ../x", { sessionId: "../x" }],
		["pid: 0", { pid: 0 }],
	])("schema rejects %s", (_name, overrides) => {
		expect(schema.safeParse(makeStored("prompt", overrides)).success).toBe(false);
	});

	it("round-trips a 50 000 character prompt with newlines unchanged", () => {
		const head = 'line one\n"quoted"\r\n';
		const text = head + "x".repeat(50_000 - head.length);
		expect(text).toHaveLength(50_000);
		const parsed = schema.parse(makeStored("prompt", { text }));
		expect(parsed.kind === "prompt" && parsed.text).toBe(text);
		expect(inputSchema.parse({ kind: "prompt", text })).toEqual({ kind: "prompt", text });
	});

	it("session_started with no optional fields adds no keys", () => {
		const parsed = inputSchema.parse({ kind: "session_started" });
		expect(Object.keys(parsed)).toEqual(["kind"]);
		const stored = schema.parse(makeStored("session_started"));
		expect("projectRoot" in stored).toBe(false);
		expect("kanbanTag" in stored).toBe(false);
		expect("brainPath" in stored).toBe(false);
	});

	it("rejects a phase outside the enum in both schemas", () => {
		const bad = { ...MINIMAL.phase_started, phase: "deploy" };
		expect(inputSchema.safeParse(bad).success).toBe(false);
		expect(schema.safeParse({ ...ENVELOPE, ...bad }).success).toBe(false);
	});

	it("rejects a commit sha of XYZ", () => {
		expect(inputSchema.safeParse({ kind: "commit", sha: "XYZ" }).success).toBe(false);
	});
});
