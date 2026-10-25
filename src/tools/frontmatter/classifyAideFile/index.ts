import type { AideFileKind } from "../types/index.js";

/**
 * Decides which kind of AIDE file a name is, from the basename alone, so a full
 * path (POSIX or Windows separators) and a bare name classify the same. This is
 * the only classifier for governed values; it is deliberately separate from the
 * tree-tag classifier in src/util/classify.
 */
export default function classifyAideFile(fileName: string): AideFileKind {
	const base = fileName.split(/[\\/]/).pop() ?? "";

	if (!base.endsWith(".aide")) return "not-aide";
	if (base === "plan.aide") return "plan";
	if (base === "todo.aide") return "todo";
	if (base === "brief.aide") return "brief";
	if (base === "research.aide") return "research";
	if (base === "session.aide" || base === "handoff.aide") return "session";
	if (base === "brain.aide") return "config";

	// `.aide`, `intent.aide` and any other `<name>.aide` (e.g. readme.aide) are intent specs.
	return "intent-spec";
}
