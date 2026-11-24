import type { HistoryModel, HistoryTypeFilter } from "@/observer/page/types/index.js";

/** The type filters in the order the handoff draws them, each with its label. */
const CHIPS: { id: Exclude<HistoryTypeFilter, "all">; label: string }[] = [
	{ id: "phases", label: "Phases" },
	{ id: "gates", label: "Gates" },
	{ id: "qa", label: "QA" },
	{ id: "tasks", label: "Tasks" },
	{ id: "files", label: "Files" },
	{ id: "commits", label: "Commits" },
	{ id: "prompts", label: "Prompts" },
	{ id: "errors", label: "Errors" },
];

/** The type filters the panel offers: `All`, then each category that has rows, labelled with its count (`Phases 7`). */
export default function buildTypeChips({ counts }: { counts: HistoryModel["counts"] }): { id: HistoryTypeFilter; label: string }[] {
	const present = CHIPS.flatMap((chip) => {
		const count = counts[chip.id];
		return count === undefined || count === 0 ? [] : [{ id: chip.id, label: `${chip.label} ${count}` }];
	});
	return [{ id: "all", label: "All" }, ...present];
}
