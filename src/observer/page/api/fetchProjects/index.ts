import type { ProjectListing } from "@/observer/types/index.js";
import type { ApiResult } from "@/observer/page/types/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** GET /api/projects — every project the observer holds, with its sessions. */
export default function fetchProjects({ token }: { token: string }): Promise<ApiResult<{ projects: ProjectListing[] }>> {
	return requestJson({ path: "/api/projects", token });
}
