import type { BoardColumnId, BoardTask } from "@/types/index.js";
import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** GET /api/projects/<key>/task/<slug> — one kanban task's note and parsed fields. */
export default function fetchTask({
	token,
	projectKey,
	slug,
}: {
	token: string;
	projectKey: string;
	slug: string;
}): Promise<ApiResult<{ slug: string; column: BoardColumnId; markdown: string; task: BoardTask }>> {
	return requestJson({
		path: projectPath({ projectKey, rest: `task/${encodeURIComponent(slug)}` }),
		token,
	});
}
