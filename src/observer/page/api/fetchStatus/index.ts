import type { ProjectView } from "@/observer/types/index.js";
import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** GET /api/projects/<key>/status — the project's view: its status, or no-project-root. */
export default function fetchStatus({
	token,
	projectKey,
}: {
	token: string;
	projectKey: string;
}): Promise<ApiResult<ProjectView>> {
	return requestJson({ path: projectPath({ projectKey, rest: "status" }), token });
}
