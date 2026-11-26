import type { ObserverContext } from "../../types/index.js";

/**
 * The `--kanban` folder for one project, or undefined. The override names the project the view
 * command was run from (brief commitments #12, #49, #111), so every other project keeps the board
 * its own brain config locates.
 */
export default function pickKanbanOverride({
	ctx,
	projectKey,
}: {
	ctx: ObserverContext;
	projectKey: string;
}): string | undefined {
	if (ctx.kanbanOverride === undefined) return undefined;
	return ctx.kanbanOverride.projectKey === projectKey ? ctx.kanbanOverride.kanbanPath : undefined;
}
