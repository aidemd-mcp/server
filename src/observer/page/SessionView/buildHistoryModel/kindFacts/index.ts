import type { HistoryCategory, HistoryKind, IconName } from "@/observer/page/types/index.js";

/**
 * What each history row kind looks like, as the handoff's maps give it: the glyph, the
 * screen-reader word (with its colon, spoken before the label) and the category the type filters
 * count it under. `files` and `sub` both count as files.
 */
const KIND_FACTS = {
	start: { icon: "power", kindWord: "session started: ", category: "sessions" },
	prompt: { icon: "prompt", kindWord: "prompt: ", category: "prompts" },
	task: { icon: "task", kindWord: "task: ", category: "tasks" },
	phase: { icon: "flag", kindWord: "phase started: ", category: "phases" },
	done: { icon: "done", kindWord: "phase finished: ", category: "phases" },
	wait: { icon: "wait", kindWord: "waiting on you: ", category: "gates" },
	approve: { icon: "gate", kindWord: "approved: ", category: "gates" },
	step: { icon: "step", kindWord: "plan step: ", category: "phases" },
	issues: { icon: "issues", kindWord: "QA issues: ", category: "qa" },
	pass: { icon: "done", kindWord: "QA passed: ", category: "qa" },
	commit: { icon: "commit", kindWord: "commit: ", category: "commits" },
	release: { icon: "tag", kindWord: "release: ", category: "commits" },
	error: { icon: "error", kindWord: "error: ", category: "errors" },
	files: { icon: "files", kindWord: "files written: ", category: "files" },
	sub: { icon: "file", kindWord: "file: ", category: "files" },
} as const satisfies Record<HistoryKind, { icon: IconName; kindWord: string; category: HistoryCategory }>;

export default KIND_FACTS;
