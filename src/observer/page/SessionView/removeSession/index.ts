import deleteSession from "@/observer/page/api/deleteSession/index.js";

/**
 * Permanently deletes one archived session through the observer and answers null on success or
 * the observer's message on failure (the confirm box shows it). Only an archived session can be
 * deleted, and an archived session is never the one the page is on, so nothing navigates; the
 * caller refreshes its archived list.
 */
export default async function removeSession({
	token,
	projectKey,
	sessionId,
}: {
	token: string;
	projectKey: string;
	sessionId: string;
}): Promise<string | null> {
	const result = await deleteSession({ token, projectKey, sessionId });
	return result.ok ? null : result.message;
}
