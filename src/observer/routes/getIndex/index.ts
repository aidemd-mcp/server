import protocol from "@/service/observer/event/shared/protocol/index.js";
import routeTable from "../../shared/routeTable/index.js";
import sendJson from "../../shared/sendJson/index.js";
import sendPage from "../../shared/sendPage/index.js";
import wantsHtml from "../../shared/wantsHtml/index.js";
import type { RouteInput } from "../../types/index.js";

const ROUTES = routeTable.map(({ method, path, purpose }) => ({
	method,
	path: path.replace(/:(\w+)/g, "<$1>"),
	purpose,
}));

/**
 * GET / — one path, two answers told apart by Accept: a browser (text/html) gets the page shell, the
 * single-instance probe and API callers get the route list and the running version as JSON. Both
 * carry `Vary: Accept`. Answers during the replay. The shell goes out without the token; the JSON keeps it.
 */
export default async function getIndex({ req, res, ctx }: RouteInput): Promise<void> {
	const headers = { Vary: "Accept" };
	if (wantsHtml({ accept: req.headers.accept })) {
		sendPage({ res, headers });
		return;
	}
	sendJson({ res, status: 200, body: { data: { observer: protocol.indexMarker, version: ctx.version, ready: ctx.store.isReady(), routes: ROUTES } }, headers });
}
