import type { ChipTone, FileChipModel, IconName, ModuleRow } from "@/observer/page/types/index.js";
import baseName from "@/util/baseName/index.js";

/** The plan chip's tone and icon per reported status (the handoff's `chipOf`); an unset status is the muted `todo` chip. */
const PLAN_LOOK: Record<string, { tone: ChipTone; icon: IconName }> = {
	proposed: { tone: "warn", icon: "gate" },
	approved: { tone: "run", icon: "run" },
	completed: { tone: "done", icon: "done" },
	abandoned: { tone: "muted", icon: "close" },
	unset: { tone: "muted", icon: "todo" },
};

/**
 * The file chips under a module's node, one per `.aide` file it holds, named by file: the intent spec
 * (`.aide`, or `intent.aide` at the root), the root's `session.aide`, then brief, plan, research, todo.
 * Each chip is a file the observer read: a file it could not read has none. A plan reads
 * `plan.aide · <status>` with `<done>/<total>`; a todo reads `<open> open of <total>`, danger while any is open.
 */
export default function buildChips({ module }: { module: ModuleRow }): FileChipModel[] {
	const chips: FileChipModel[] = [];
	if (module.intentFile !== null) {
		chips.push({ kind: "spec", tone: "", icon: "doc", key: baseName(module.intentFile), value: null, file: module.intentFile });
	}
	if (module.folder === ".") chips.push({ kind: "session", tone: "", icon: "history", key: "session.aide", value: null, file: ".aide/session.aide" });
	if (module.brief !== null) chips.push({ kind: "brief", tone: "", icon: "doc", key: "brief.aide", value: null, file: module.brief });
	if (module.plan !== null) {
		const look = PLAN_LOOK[module.plan.status] ?? PLAN_LOOK.unset!;
		chips.push({
			kind: "plan",
			tone: look.tone,
			icon: look.icon,
			key: module.plan.status === "unset" ? "plan.aide" : `plan.aide · ${module.plan.status}`,
			value: `${module.plan.done}/${module.plan.total}`,
			file: module.plan.file,
		});
	}
	if (module.research !== null) chips.push({ kind: "research", tone: "", icon: "search", key: "research.aide", value: null, file: module.research });
	if (module.todo !== null) {
		const open = module.todo.open;
		chips.push({
			kind: "todo",
			tone: open > 0 ? "danger" : "done",
			icon: open > 0 ? "issues" : "done",
			key: "todo.aide",
			value: `${open} open of ${module.todo.total}`,
			file: module.todo.file,
		});
	}
	return chips;
}
