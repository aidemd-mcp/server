import rebuildStatus from "../rebuildStatus/index.js";
import findProject from "../shared/findProject/index.js";
import pickBrainOverride from "../shared/pickBrainOverride/index.js";
import type { ObserverContext, ProjectView } from "../types/index.js";

const NO_ROOT_DETAIL =
	"No session of this project reported its project root, so its files and board cannot be shown.";

/**
 * Builds one project's view. A project nobody holds is null. A project whose sessions never
 * reported a root is `no-project-root` (status needs a root to read files, and resolving an empty
 * root would read the observer's own working folder; brief commitment #48). Otherwise the status
 * is rebuilt from that project's sessions only, with the `--brain` override applied only when it
 * names this project. A throw from the status builder propagates to the caller.
 */
export default async function buildProjectView({
	ctx,
	projectKey,
}: {
	ctx: ObserverContext;
	projectKey: string;
}): Promise<ProjectView | null> {
	const project = findProject({ ctx, projectKey });
	if (project.kind === "missing") return null;
	if (project.projectRoot === null) return { state: "no-project-root", projectKey, detail: NO_ROOT_DETAIL };

	const status = await rebuildStatus({
		projectRoot: project.projectRoot,
		sessions: project.sessions,
		brainOverride: pickBrainOverride({ ctx, projectKey }),
	});
	return { state: "ready", projectKey, status };
}
