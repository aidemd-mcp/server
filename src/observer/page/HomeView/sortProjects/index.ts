import type { ProjectRowModel } from "@/observer/page/types/index.js";

/** How Home orders its projects: by activity, or in the viewer's own saved order. */
export type ProjectOrder = "activity" | "custom";

/** A project's activity rank: waiting on you first, then a phase running, then everything else. */
function rankOf(project: ProjectRowModel): number {
	if (project.waiting) return 0;
	const badge = project.status?.badge.className;
	return badge === "run" ? 1 : 2;
}

/**
 * Home's project order. `activity`: waiting on you, then a phase running, then the rest, each group
 * newest event first. `custom`: the viewer's saved order (`custom`, project keys), with any project
 * not in it after those, by activity. Pure; returns a new array.
 */
export default function sortProjects({
	projects,
	order,
	custom,
}: {
	projects: ProjectRowModel[];
	order: ProjectOrder;
	custom: string[];
}): ProjectRowModel[] {
	const byActivity = [...projects].sort((a, b) => {
		const rank = rankOf(a) - rankOf(b);
		if (rank !== 0) return rank;
		const at = (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? "");
		return at !== 0 ? at : a.name.localeCompare(b.name);
	});
	if (order === "activity") return byActivity;
	const position = new Map(custom.map((key, index) => [key, index]));
	return byActivity
		.map((project, index) => ({ project, index }))
		.sort((a, b) => (position.get(a.project.projectKey) ?? custom.length + a.index) - (position.get(b.project.projectKey) ?? custom.length + b.index))
		.map(({ project }) => project);
}
