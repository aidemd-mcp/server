import type { ObserverContext } from "../../types/index.js";

/**
 * The `--brain` path for one project, or undefined. The override names the project the view
 * command was run from (brief commitments #12, #49), so every other project keeps the brain path
 * its own newest session reported.
 */
export default function pickBrainOverride({
	ctx,
	projectKey,
}: {
	ctx: ObserverContext;
	projectKey: string;
}): string | undefined {
	if (ctx.brainOverride === undefined) return undefined;
	return ctx.brainOverride.projectKey === projectKey ? ctx.brainOverride.brainPath : undefined;
}
