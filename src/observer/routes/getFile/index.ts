import { readFile, stat } from "node:fs/promises";
import findProject from "../../shared/findProject/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";
import resolveConfinedPath from "./resolveConfinedPath/index.js";

const FILE_SIZE_LIMIT = 2_097_152;

/**
 * GET /api/projects/:project/file?path=<p> — one UTF-8 text file confined to that project's
 * reported root (the root its newest session reported); never lists a directory. A project whose
 * sessions never reported a root answers 409, and no read is attempted.
 */
export default async function getFile({ res, url, params, ctx }: RouteInput): Promise<void> {
	const project = findProject({ ctx, projectKey: params.project });
	if (project.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such project." } } });
		return;
	}
	if (project.projectRoot === null) {
		sendJson({
			res,
			status: 409,
			body: { error: { message: "No session of this project reported its project root, so its files cannot be read." } },
		});
		return;
	}

	const requested = url.searchParams.get("path");
	if (!requested) {
		sendJson({ res, status: 400, body: { error: { message: "The path query parameter is required." } } });
		return;
	}

	const confined = await resolveConfinedPath({ projectRoot: project.projectRoot, requested });
	if (confined.kind === "refused") {
		sendJson({ res, status: 403, body: { error: { message: "That path is outside the project." } } });
		return;
	}
	if (confined.kind === "missing") {
		sendJson({ res, status: 404, body: { error: { message: "No such file." } } });
		return;
	}
	if (confined.kind === "not-a-file") {
		sendJson({ res, status: 400, body: { error: { message: "That path is not a file." } } });
		return;
	}

	const { size } = await stat(confined.file);
	if (size > FILE_SIZE_LIMIT) {
		sendJson({
			res,
			status: 413,
			body: { error: { message: "That file is too large to serve.", details: `Limit is ${FILE_SIZE_LIMIT} bytes.` } },
		});
		return;
	}

	const text = await readFile(confined.file, "utf-8");
	sendJson({ res, status: 200, body: { data: { path: confined.relativePath, text } } });
}
