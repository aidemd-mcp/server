import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** POST /api/projects/<key>/archive/<id>/restore — moves one archived session's recording back into the project's history. */
export default function restoreSession({
	token,
	projectKey,
	sessionId,
}: {
	token: string;
	projectKey: string;
	sessionId: string;
}): Promise<ApiResult<{ restored: string }>> {
	return requestJson({
		path: projectPath({ projectKey, rest: `archive/${encodeURIComponent(sessionId)}/restore` }),
		token,
		method: "POST",
	});
}
