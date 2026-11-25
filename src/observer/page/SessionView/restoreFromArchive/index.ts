import restoreSession from "@/observer/page/api/restoreSession/index.js";

/**
 * Restores one archived session through the observer and answers null on success or the
 * observer's message on failure (the row shows it). A success needs nothing more here: the
 * stream's `sessions` and `status` frames return the session to the lists.
 */
export default async function restoreFromArchive({
	token,
	projectKey,
	sessionId,
}: {
	token: string;
	projectKey: string;
	sessionId: string;
}): Promise<string | null> {
	const result = await restoreSession({ token, projectKey, sessionId });
	return result.ok ? null : result.message;
}
