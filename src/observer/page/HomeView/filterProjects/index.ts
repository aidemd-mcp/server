import type { ProjectRowModel } from "@/observer/page/types/index.js";

/** The projects whose name or root contains the query, ignoring case and surrounding spaces; an empty query keeps them all. */
export default function filterProjects({ projects, query }: { projects: ProjectRowModel[]; query: string }): ProjectRowModel[] {
	const needle = query.trim().toLowerCase();
	if (needle === "") return projects;
	return projects.filter((project) => project.name.toLowerCase().includes(needle) || (project.root ?? "").toLowerCase().includes(needle));
}
