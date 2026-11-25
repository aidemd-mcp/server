import type { ObserverEvent } from "@/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

type ModuleEvent = ObserverEvent & { module: string };

/**
 * The module the rail is about: the one named by the newest of the pipeline's events that name one,
 * in the project-relative form the tree uses. Null when no event does, so the rail then says no module
 * rather than guessing one.
 */
export default function findRailModule({ pipelineEvents, projectRoot }: { pipelineEvents: ObserverEvent[]; projectRoot: string }): string | null {
	const named = pipelineEvents.filter((event): event is ModuleEvent => "module" in event && typeof event.module === "string").at(-1);
	if (!named) return null;
	return normalizeModule({ projectRoot, module: named.module });
}
