import type { ChipTone, FileChipModel, IconName, ModuleRow } from "@/observer/page/types/index.js";

/** The plan chip's tone and icon per reported status (the handoff's `chipOf`); an unset status is the muted `todo` chip. */
const PLAN_LOOK: Record<string, { tone: ChipTone; icon: IconName }> = {
	proposed: { tone: "warn", icon: "gate" },
	approved: { tone: "run", icon: "run" },
	completed: { tone: "done", icon: "done" },
	abandoned: { tone: "muted", icon: "close" },
	unset: { tone: "muted", icon: "todo" },
};

/**
 * The file chips under a module's node, in the handoff's order: brief, plan, research, todo. Each chip
 * is a file the observer read: a file it could not read has none. A plan reads `plan · <status>` with
 * `<done>/<total>`, and a plan with no status is just `plan`; a todo reads `<open> open of <total>`,
 * danger while any is open.
 */
export default function buildChips({ module }: { module: ModuleRow }): FileChipModel[] {
	const chips: FileChipModel[] = [];
	if (module.brief !== null) chips.push({ kind: "brief", tone: "", icon: "doc", key: "brief", value: null, file: module.brief });
	if (module.plan !== null) {
		const look = PLAN_LOOK[module.plan.status] ?? PLAN_LOOK.unset!;
		chips.push({
			kind: "plan",
			tone: look.tone,
			icon: look.icon,
			key: module.plan.status === "unset" ? "plan" : `plan · ${module.plan.status}`,
			value: `${module.plan.done}/${module.plan.total}`,
			file: module.plan.file,
		});
	}
	if (module.research !== null) chips.push({ kind: "research", tone: "", icon: "search", key: "research", value: null, file: module.research });
	if (module.todo !== null) {
		const open = module.todo.open;
		chips.push({
			kind: "todo",
			tone: open > 0 ? "danger" : "done",
			icon: open > 0 ? "issues" : "done",
			key: "todo",
			value: `${open} open of ${module.todo.total}`,
			file: module.todo.file,
		});
	}
	return chips;
}
