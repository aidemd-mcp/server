import protocol from "@/service/observer/event/shared/protocol/index.js";

/**
 * The one builder of a session view's path (`/p/<key>/s/<id>`), so the link the server hands out,
 * the page's own links and the route table's pattern share one shape. The key and id are encoded
 * so a project folder name with a space or other reserved character still yields one valid path.
 * Browser-safe: it imports only the protocol, never a `node:` module, because the page bundle
 * imports it too.
 */
export default function buildSessionPath({ projectKey, sessionId }: { projectKey: string; sessionId: string }): string {
	return protocol.sessionRoute
		.replace(":project", () => encodeURIComponent(projectKey))
		.replace(":session", () => encodeURIComponent(sessionId));
}
