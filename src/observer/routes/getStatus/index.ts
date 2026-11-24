import buildProjectView from "../../buildProjectView/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * GET /api/projects/:project/status — the project's view: its rebuilt status, or the
 * `no-project-root` state when no session reported a root. An unknown project is 404; a throw
 * from the rebuild becomes handleRequest's 500.
 */
export default async function getStatus({ res, params, ctx }: RouteInput): Promise<void> {
	const view = await buildProjectView({ ctx, projectKey: params.project });
	if (view === null) {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}
	sendJson({ res, status: 200, body: { data: view } });
}
