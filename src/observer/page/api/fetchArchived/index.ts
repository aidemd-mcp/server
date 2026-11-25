import type { SessionListing } from "@/observer/types/index.js";
import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** GET /api/projects/<key>/archive — the project's archived sessions, in the shape of its sessions list. */
export default function fetchArchived({
	token,
	projectKey,
}: {
	token: string;
	projectKey: string;
}): Promise<ApiResult<{ sessions: SessionListing[] }>> {
	return requestJson({ path: projectPath({ projectKey, rest: "archive" }), token });
}
