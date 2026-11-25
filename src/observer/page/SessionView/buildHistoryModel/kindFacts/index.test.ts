import { describe, expect, it } from "vitest";
import KIND_FACTS from "./index.js";

/** The handoff's `cat`, `iconOf` and `wordOf` maps (Viewer.dc.html, renderVals), with `wordOf` given its `: ` suffix as the row prints it. */
const HANDOFF = {
	start: ["sessions", "power", "session started: "],
	prompt: ["prompts", "prompt", "prompt: "],
	task: ["tasks", "task", "task: "],
	phase: ["phases", "flag", "phase started: "],
	pipeline: ["phases", "loop", "pipeline: "],
	skip: ["phases", "todo", "skipped: "],
	done: ["phases", "done", "phase finished: "],
	wait: ["gates", "wait", "waiting on you: "],
	approve: ["gates", "gate", "approved: "],
	step: ["phases", "step", "plan step: "],
	issues: ["qa", "issues", "QA issues: "],
	pass: ["qa", "done", "QA passed: "],
	commit: ["commits", "commit", "commit: "],
	release: ["commits", "tag", "release: "],
	error: ["errors", "error", "error: "],
	files: ["files", "files", "files written: "],
	sub: ["files", "file", "file: "],
} as const;

describe("KIND_FACTS", () => {
	it.each(Object.entries(HANDOFF))("gives %s the handoff's category, glyph and screen-reader word", (kind, [category, icon, kindWord]) => {
		expect(KIND_FACTS[kind as keyof typeof KIND_FACTS]).toEqual({ category, icon, kindWord });
	});
});
