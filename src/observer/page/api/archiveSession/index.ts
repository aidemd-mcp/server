import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** POST /api/projects/<key>/sessions/<id>/archive — moves one past session's recording into the project's archive; the observer refuses a live one. */
export default function archiveSession({
	token,
	projectKey,
	sessionId,
}: {
	token: string;
	projectKey: string;
	sessionId: string;
}): Promise<ApiResult<{ archived: string }>> {
	return requestJson({
		path: projectPath({ projectKey, rest: `sessions/${encodeURIComponent(sessionId)}/archive` }),
		token,
		method: "POST",
	});
}
