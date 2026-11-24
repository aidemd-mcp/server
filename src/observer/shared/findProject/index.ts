import { isAbsolute } from "node:path";
import findNewestStart from "@/service/observer/event/shared/findNewestStart/index.js";
import isProjectKey from "@/util/runtimePaths/isProjectKey/index.js";
import type { ObserverContext, ProjectLookup } from "../../types/index.js";

/**
 * Resolves the `:project` segment of a route to a held project. A key that is not shaped like a
 * project key or that has no held session is `missing`; otherwise the project's own sessions and
 * the project root its newest session reported (event's `findNewestStart`, never merged with older
 * sessions; null when none reported one or the reported one is not an absolute path). Every per-project route starts here, so no route can
 * read another project's sessions.
 */
export default function findProject({ ctx, projectKey }: { ctx: ObserverContext; projectKey: string }): ProjectLookup {
	if (!isProjectKey(projectKey)) return { kind: "missing" };

	const sessions = ctx.store.sessions({ projectKey });
	if (sessions.length === 0) return { kind: "missing" };

	// The reported root is agent-supplied: a relative one would resolve against the observer's own
	// working directory (another project's folder), so only an absolute root counts as a root.
	const reportedRoot = findNewestStart({ sessions })?.projectRoot;
	const projectRoot = reportedRoot !== undefined && isAbsolute(reportedRoot) ? reportedRoot : null;
	return { kind: "found", projectKey, projectRoot, sessions };
}
