import type { Phase } from "@/types/index.js";
import type { RailContext } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import formatRunningFor from "@/observer/page/SessionView/buildNowCard/formatRunningFor/index.js";

/**
 * How long the running phase has run, counted the way the now card counts it (the status's elapsed
 * time plus what has passed since the status was built), so the two never disagree. Null when the
 * status holds no running work for the rail's session and phase (and module, when the pipeline's events name one).
 */
export default function findElapsed({ phase, ctx }: { phase: Phase; ctx: RailContext }): string | null {
	const { status } = ctx;
	if (status === null) return null;
	const work = status.running.find(
		(candidate) =>
			candidate.sessionId === ctx.sessionId &&
			candidate.phase === phase &&
			(ctx.module === null || normalizeModule({ projectRoot: ctx.projectRoot, module: candidate.module }) === ctx.module),
	);
	if (!work) return null;
	return formatRunningFor({ elapsedMs: work.elapsedMs, asOf: status.generatedAt, now: ctx.now });
}
