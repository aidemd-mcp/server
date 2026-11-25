import type { ObserverEvent } from "@/types/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";

type GateEvent = Extract<ObserverEvent, { kind: "gate_waiting" | "gate_resolved" }>;

/** True for a path that names a plan.aide, the file whose gate is the Plan approval cell. */
function isPlanFile(file: string): boolean {
	return file === "plan.aide" || file.endsWith("/plan.aide");
}

/**
 * The Plan approval cell, which no phase names, read only from the pipeline's own gate events (a gate
 * of another pipeline never reaches it). A `gate_waiting` on a plan.aide that the status still lists
 * as waiting is `wait` with how long it has waited; a `gate_resolved` for a plan.aide is `done` with
 * how long the gate stood open (from its `gate_waiting`), or plain `Approved` when that event is not
 * held; anything else is not started.
 */
export default function describeApproval({ ctx }: { ctx: RailContext }): RailCellDescription {
	const gates = ctx.pipelineEvents
		.filter((event): event is GateEvent => event.kind === "gate_waiting" || event.kind === "gate_resolved")
		.map((event) => ({ event, file: normalizeModule({ projectRoot: ctx.projectRoot, module: event.file }) }))
		.filter(({ file }) => isPlanFile(file));

	const open = gates
		.filter(({ event }) => event.kind === "gate_waiting")
		.map(({ file }) => ctx.status?.waiting.find((waiting) => waiting.kind === "plan" && waiting.file === file))
		.filter((waiting) => waiting !== undefined)
		.at(-1);
	if (open) return { state: "wait", meta: `Waiting · ${formatAgo({ iso: open.since, now: ctx.now })}`, loop: null };

	const resolvedAt = gates.map(({ event }) => event.kind).lastIndexOf("gate_resolved");
	if (resolvedAt === -1) return { state: "todo", meta: NOT_STARTED, loop: null };

	const resolved = gates[resolvedAt];
	const opened = gates.slice(0, resolvedAt).filter(({ event, file }) => event.kind === "gate_waiting" && file === resolved.file).at(-1);
	if (!opened) return { state: "done", meta: "Approved", loop: null };
	return { state: "done", meta: `Approved ${formatSpan((Date.parse(resolved.event.ts) - Date.parse(opened.event.ts)) / 1000)}`, loop: null };
}
