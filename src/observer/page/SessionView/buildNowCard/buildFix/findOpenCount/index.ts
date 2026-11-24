import type { ObserverEvent } from "@/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

/** The `open` count the module's newest QA verdict reported, or null when it reported none or no verdict exists. */
export default function findOpenCount({
	projectRoot,
	events,
	module,
}: {
	projectRoot: string;
	events: ObserverEvent[];
	module: string;
}): number | null {
	const folder = normalizeModule({ projectRoot, module });
	let newest: Extract<ObserverEvent, { kind: "qa_verdict" }> | null = null;
	for (const event of events) {
		if (event.kind !== "qa_verdict" || normalizeModule({ projectRoot, module: event.module }) !== folder) continue;
		if (newest === null || event.ts > newest.ts || (event.ts === newest.ts && event.seq > newest.seq)) newest = event;
	}
	return newest?.open ?? null;
}
