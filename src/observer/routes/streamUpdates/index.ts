import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * GET /api/stream[?project=<key>] — opens the server-sent-event stream. With `?project=` the
 * client sees only that project's frames and its snapshot holds only that project's sessions; the
 * key must be a held project, else 404 and no stream is opened. Without it the client sees every
 * project. The snapshot is taken and the client registered in the same synchronous turn, so every
 * event reaches the client exactly once: in the snapshot or as a live frame. A filtered client
 * gets its project's status pushed after the snapshot, so its first status frame is fresh.
 */
export default async function streamUpdates({ res, url, ctx }: RouteInput): Promise<void> {
	const projectKey = url.searchParams.get("project") ?? undefined;
	if (projectKey !== undefined && (!isProjectKey(projectKey) || ctx.store.sessions({ projectKey }).length === 0)) {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}

	ctx.hub.subscribe({ res, snapshot: { sessions: ctx.store.sessions({ projectKey }) }, projectKey });
	if (projectKey !== undefined) ctx.statusPusher.push(projectKey);
}
