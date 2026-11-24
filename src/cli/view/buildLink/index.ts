import buildViewLink from "@/observer/buildViewLink/index.js";
import read from "@/service/observer/event/read/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";

/**
 * The link the view command prints: the newest session of the project it was run from, so the
 * user lands on the work in progress (brief commitment #40), or the observer's home when that
 * project has no sessions or its logs cannot be read. Reads the project's own logs, not the
 * observer, so the link is right even for an observer this command did not start.
 */
export default async function buildLink({
	observer,
	projectRoot,
}: {
	observer: { address: string; token: string };
	projectRoot: string;
}): Promise<string> {
	const { projectKey } = resolve({ projectRoot });

	const projects = await read({ projectKey }).catch(() => []);
	const sessions = projects[0]?.sessions ?? [];
	const newest = sessions[sessions.length - 1];
	if (!newest) return buildViewLink({ observer });

	return buildViewLink({ observer, view: { projectKey, sessionId: newest.sessionId } });
}
