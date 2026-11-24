import type { ProjectRowModel } from "@/observer/page/types/index.js";
import compareNewest from "@/observer/page/HomeView/buildHomeModel/compareNewest/index.js";

/** Orders Home's projects by their latest event, newest first; a project with no event goes last, ties by name. */
export default function compareProjects(a: ProjectRowModel, b: ProjectRowModel): number {
	if (a.lastEventAt === b.lastEventAt) return a.name.localeCompare(b.name);
	if (a.lastEventAt === null) return 1;
	if (b.lastEventAt === null) return -1;
	return compareNewest(a.lastEventAt, b.lastEventAt);
}
