import { readFile } from "node:fs/promises";
import { join } from "node:path";
import locatePageAssets from "../../locatePageAssets/index.js";
import pageAssets from "../../shared/pageAssets/index.js";
import sendBody from "../../shared/sendBody/index.js";
import sendJson from "../../shared/sendJson/index.js";
import type { RouteInput } from "../../types/index.js";

/**
 * GET /assets/:name — the page's bundled script or stylesheet. The name is checked against the
 * two-entry allowlist before any file is touched; a bundle that has not been built answers 503
 * naming the build command; any other read error is thrown to the dispatcher's 500.
 */
export default async function getAsset({ res, params }: RouteInput): Promise<void> {
	const name = params.name;
	const contentType = Object.hasOwn(pageAssets.contentTypes, name) ? pageAssets.contentTypes[name] : undefined;
	if (!contentType) {
		sendJson({ res, status: 404, body: { error: { message: "No such asset." } } });
		return;
	}

	let body: Buffer;
	try {
		body = await readFile(join(locatePageAssets(), name));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		sendJson({ res, status: 503, body: { error: { message: "The observer page has not been built; run npm run build." } } });
		return;
	}
	sendBody({ res, status: 200, contentType, body });
}
