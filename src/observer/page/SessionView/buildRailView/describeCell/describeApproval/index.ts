import ROOT_FOLDER from "@/observer/page/shared/rootFolder/index.js";
import type { ObserverEvent } from "@/types/index.js";
import formatAgo from "@/observer/page/shared/formatAgo/index.js";
import formatSpan from "@/observer/page/shared/formatSpan/index.js";
import type { RailCellDescription, RailContext } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import NOT_STARTED from "@/observer/page/SessionView/buildRailView/notStarted/index.js";

type GateEvent = Extract<ObserverEvent, { kind: "gate_waiting" | "gate_resolved" }>;

/**
 * The Plan approval cell, which no phase names. An open gate on the module's plan.aide (from the
 * status's waiting files) is `wait` with how long it has waited; a `gate_resolved` for that plan in
 * the rail's session is `done` with how long the gate stood open (from its `gate_waiting`), or plain
 * `Approved` when that event is not held; anything else is not started.
 */
export default function describeApproval({ ctx }: { ctx: RailContext }): RailCellDescription {
	const waiting = ctx.status?.waiting.find((file) => file.kind === "plan" && file.folder === ctx.module);
	if (waiting) return { state: "wait", meta: `Waiting · ${formatAgo({ iso: waiting.since, now: ctx.now })}`, loop: null };

	const planFile = ctx.module === ROOT_FOLDER ? ".aide/plan.aide" : `${ctx.module}/plan.aide`;
	const gates = ctx.sessionEvents.filter(
		(event): event is GateEvent =>
			(event.kind === "gate_waiting" || event.kind === "gate_resolved") &&
			normalizeModule({ projectRoot: ctx.projectRoot, module: event.file }) === planFile,
	);
	const resolved = gates.filter((event) => event.kind === "gate_resolved").at(-1);
	if (!resolved) return { state: "todo", meta: NOT_STARTED, loop: null };

	const opened = gates.filter((event) => event.kind === "gate_waiting" && event.seq < resolved.seq).at(-1);
	if (!opened) return { state: "done", meta: "Approved", loop: null };
	return { state: "done", meta: `Approved ${formatSpan((Date.parse(resolved.ts) - Date.parse(opened.ts)) / 1000)}`, loop: null };
}
