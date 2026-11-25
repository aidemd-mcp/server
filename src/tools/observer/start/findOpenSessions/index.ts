import read from "@/service/observer/event/read/index.js";
import readLiveness from "@/service/observer/event/readLiveness/index.js";
import findCurrentPipeline from "@/service/observer/status/shared/findCurrentPipeline/index.js";
import findOpenPhase from "@/service/observer/status/shared/findOpenPhase/index.js";
import resolve from "@/util/runtimePaths/resolve/index.js";
import type { OpenSession } from "../types/index.js";

/**
 * Lists every other open session of the project for the HALT (brief commitments #69, #82, #84,
 * #94): each logged session that is not ended and is not the caller's, oldest first, with its
 * current pipeline and open phase from the same rules the status page uses; then each hook
 * presence that never linked to an observer session and is not ended, named by its Claude session
 * id with no pipeline or phase. Reads only disk, never the running observer: a freshly started
 * observer has replayed nothing, so asking it would let a HALT vanish. Throws when the project's
 * files cannot be read; the caller turns that into a blocked reply.
 */
export default async function findOpenSessions({
	projectRoot,
	callerSessionId,
}: {
	projectRoot: string;
	callerSessionId: string;
}): Promise<OpenSession[]> {
	const { projectKey } = resolve({ projectRoot });
	const [project] = await read({ projectKey });

	// A project with presence but no log has no entry in `read`; its presence still counts (#82).
	const unlinked = project
		? project.unlinked
		: (await readLiveness({ projectKey, sessions: [], now: Date.now() })).unlinked;

	const sessions = (project?.sessions ?? [])
		.filter((session) => session.liveness.state !== "ended" && session.sessionId !== callerSessionId)
		.map((session): OpenSession => {
			const pipeline = findCurrentPipeline({ events: session.events })?.pipeline ?? null;
			const phase = findOpenPhase({ projectRoot, events: session.events, pipeline })?.phase ?? null;
			return { id: session.sessionId, idKind: "session", liveness: session.liveness, pipeline, phase };
		});

	const claude = unlinked
		.filter((presence) => presence.liveness.state !== "ended")
		.map(
			(presence): OpenSession => ({
				id: presence.claudeSessionId,
				idKind: "claude",
				liveness: presence.liveness,
				pipeline: null,
				phase: null,
			}),
		);

	return [...sessions, ...claude];
}
