import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** DELETE /api/projects/<key>/sessions/<id> — removes one past session's recording; the observer refuses a live one. */
export default function deleteSession({
	token,
	projectKey,
	sessionId,
}: {
	token: string;
	projectKey: string;
	sessionId: string;
}): Promise<ApiResult<{ deleted: string }>> {
	return requestJson({
		path: projectPath({ projectKey, rest: `sessions/${encodeURIComponent(sessionId)}` }),
		token,
		method: "DELETE",
	});
}
