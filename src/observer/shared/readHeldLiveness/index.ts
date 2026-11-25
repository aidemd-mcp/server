import readLiveness from "@/service/observer/event/readLiveness/index.js";
import type { LivenessReport } from "@/types/index.js";
import type { HeldSession, ObserverContext } from "../../types/index.js";

/**
 * Reads the recording side's liveness for the held sessions, once per project (brief commitments
 * #14, #76): the held sessions (all of them, or one project's when `projectKey` is given) are grouped
 * by project and event's `readLiveness` judges each group. The result is keyed by project key and
 * holds one report for every project that holds a session. Presence is never cached here, so every
 * call reflects the files on disk now.
 */
export default async function readHeldLiveness({
	ctx,
	projectKey,
}: {
	ctx: ObserverContext;
	projectKey?: string;
}): Promise<Map<string, LivenessReport>> {
	// 1. Group the held sessions by the project they were filed under.
	const byProject = new Map<string, HeldSession[]>();
	for (const session of ctx.store.sessions(projectKey === undefined ? undefined : { projectKey })) {
		const held = byProject.get(session.projectKey);
		if (held === undefined) byProject.set(session.projectKey, [session]);
		else held.push(session);
	}

	// 2. One readLiveness call per project, all at the same instant, in parallel.
	const now = ctx.now();
	const reports = await Promise.all(
		[...byProject].map(
			async ([key, sessions]): Promise<[string, LivenessReport]> => [key, await readLiveness({ projectKey: key, sessions, now })],
		),
	);
	return new Map(reports);
}
