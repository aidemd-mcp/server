import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent, Status } from "@/types/index.js";
import type { LaneCell, RailCell, RailContext, RailSlot, RailView } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";
import buildIdleRail from "./buildIdleRail/index.js";
import describeCell from "./describeCell/index.js";
import describeLane from "./describeLane/index.js";
import NOT_STARTED from "./notStarted/index.js";

/** The nine cells in rail order; Plan approval and Done are the two no phase names. */
const SLOTS: { slot: RailSlot; name: string }[] = [
	{ slot: "spec", name: PHASE_LABELS.spec },
	{ slot: "research", name: PHASE_LABELS.research },
	{ slot: "synthesize", name: PHASE_LABELS.synthesize },
	{ slot: "plan", name: PHASE_LABELS.plan },
	{ slot: "approval", name: "Plan approval" },
	{ slot: "build", name: PHASE_LABELS.build },
	{ slot: "qa", name: PHASE_LABELS.qa },
	{ slot: "fix", name: PHASE_LABELS.fix },
	{ slot: "done", name: "Done" },
];

/** The four side lanes, each a phase of its own name. */
const LANES = ["structure", "align", "refactor", "cleanup"] as const;

/**
 * The phase rail as the handoff draws it: nine cells (Spec, Research, Synthesize, Plan, Plan
 * approval, Build, QA, Fix, Done) and four side lanes, for the module and session of the observer's
 * rail. Every word comes from a reported event (see `describeCell`); with no running or waiting
 * work the rail keeps the last module's finished phases (`buildIdleRail`), and with no module named
 * at all every cell and lane is not started. `focus` limits the idle rail to one session.
 */
export default function buildRailView({
	status,
	events,
	focus,
	now,
}: {
	status: Status | null;
	events: ObserverEvent[];
	focus: string | null;
	now: Date;
}): RailView {
	const projectRoot = status?.projectRoot ?? "";
	const rail = status?.rail ?? buildIdleRail({ events, projectRoot, ...(focus === null ? {} : { sessionId: focus }) });
	if (rail === null) {
		return {
			phases: SLOTS.map(({ name }): RailCell => ({ name, state: "todo", meta: NOT_STARTED, loop: null })),
			lanes: LANES.map((phase): LaneCell => ({ name: PHASE_LABELS[phase], state: "todo", meta: NOT_STARTED })),
			module: null,
		};
	}

	const module = normalizeModule({ projectRoot, module: rail.module });
	const sessionEvents = events.filter((event) => event.sessionId === rail.sessionId).sort((a, b) => a.seq - b.seq);
	const moduleEvents = sessionEvents.filter(
		(event) => "module" in event && typeof event.module === "string" && normalizeModule({ projectRoot, module: event.module }) === module,
	);
	const ctx: RailContext = { phases: rail.phases, module, sessionId: rail.sessionId, projectRoot, status, sessionEvents, moduleEvents, now };

	return {
		phases: SLOTS.map(({ slot, name }): RailCell => ({ name, ...describeCell({ slot, ctx }) })),
		lanes: LANES.map((phase): LaneCell => ({ name: PHASE_LABELS[phase], ...describeLane({ phase, ctx }) })),
		module,
	};
}
