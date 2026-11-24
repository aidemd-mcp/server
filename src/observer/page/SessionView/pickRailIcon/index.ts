import type { IconName, RailCellState } from "@/observer/page/types/index.js";

/** The glyph a rail cell or lane draws beside its name, so no state rests on colour alone: done, run, wait, issues (fail) and todo. */
const RAIL_ICONS: Record<RailCellState, IconName> = {
	done: "done",
	run: "run",
	wait: "wait",
	fail: "issues",
	todo: "todo",
};

export default function pickRailIcon({ state }: { state: RailCellState }): IconName {
	return RAIL_ICONS[state];
}
