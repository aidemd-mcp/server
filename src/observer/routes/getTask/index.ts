import readTask from "@/service/observer/kanban/task/read/index.js";
import findProject from "../../shared/findProject/index.js";
import pickKanbanOverride from "../../shared/pickKanbanOverride/index.js";
import pickReportedLocation from "../../shared/pickReportedLocation/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * GET /api/projects/:project/task/<slug> — one kanban task from the board its brain config locates
 * (or the --kanban override when it names this project). A project whose sessions
 * never reported a root has no board to read: 404 with the reason.
 */
export default async function getTask({ res, params, ctx }: RouteInput): Promise<void> {
	const project = findProject({ ctx, projectKey: params.project });
	if (project.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}
	if (project.projectRoot === null) {
		sendJson({
			res,
			status: 404,
			body: { error: { message: "No session of this project reported its project root, so its board cannot be read." } },
		});
		return;
	}

	const slug = params.slug;
	const reported = pickReportedLocation({ sessions: project.sessions });
	const task = await readTask({
		reported,
		kanbanOverride: pickKanbanOverride({ ctx, projectKey: project.projectKey }),
		projectRoot: project.projectRoot,
		slug,
	});

	if (task.state === "found") {
		const { column, markdown } = task;
		sendJson({ res, status: 200, body: { data: { slug: task.slug, column, markdown, task: task.task } } });
		return;
	}
	if (task.state === "unavailable") {
		sendJson({ res, status: 404, body: { error: { message: task.reason, details: task.hint } } });
		return;
	}
	if (task.state === "refused") {
		sendJson({ res, status: 403, body: { error: { message: `Task ${slug} cannot be read.`, details: task.detail } } });
		return;
	}
	sendJson({ res, status: 404, body: { error: { message: `Task ${slug} is not on the board.` } } });
}
