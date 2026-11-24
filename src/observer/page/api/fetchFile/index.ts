import type { ApiResult } from "@/observer/page/types/index.js";
import projectPath from "@/observer/page/api/projectPath/index.js";
import requestJson from "@/observer/page/api/requestJson/index.js";

/** GET /api/projects/<key>/file?path=<p> — one text file inside the project's reported root. */
export default function fetchFile({
	token,
	projectKey,
	path,
}: {
	token: string;
	projectKey: string;
	path: string;
}): Promise<ApiResult<{ path: string; text: string }>> {
	return requestJson({
		path: projectPath({ projectKey, rest: `file?path=${encodeURIComponent(path)}` }),
		token,
	});
}
