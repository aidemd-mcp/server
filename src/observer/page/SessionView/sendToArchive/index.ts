import buildHref from "@/observer/page/route/buildHref/index.js";
import archiveSession from "@/observer/page/api/archiveSession/index.js";

/**
 * Archives one ended session through the observer and answers null on success or the observer's
 * message on failure (the row shows it). Archiving the session the page itself is on
 * (`routeSessionId`) leaves for Home, since its view no longer exists; Home passes none, and every
 * other archive needs nothing more because the stream's `sessions` and `status` frames update the
 * lists. `navigate` defaults to the browser's own.
 */
export default async function sendToArchive({
	token,
	projectKey,
	sessionId,
	routeSessionId,
	navigate = (url) => window.location.assign(url),
}: {
	token: string;
	projectKey: string;
	sessionId: string;
	routeSessionId?: string;
	navigate?: (url: string) => void;
}): Promise<string | null> {
	const result = await archiveSession({ token, projectKey, sessionId });
	if (!result.ok) return result.message;
	if (sessionId === routeSessionId) navigate(buildHref({ kind: "home", token }));
	return null;
}
