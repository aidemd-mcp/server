import PHASE_LABELS from "@/service/observer/status/shared/phaseLabels/index.js";
import type { ObserverEvent, Status } from "@/types/index.js";
import type { LaneCell, RailCell, RailContext, RailSlot, RailView } from "@/observer/page/types/index.js";
import describeCell from "./describeCell/index.js";
import describeLane from "./describeLane/index.js";
import findRailModule from "./findRailModule/index.js";
import NOT_STARTED from "./notStarted/index.js";
import selectPipelineEvents from "./selectPipelineEvents/index.js";

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
 * The pipeline rail as the handoff draws it: nine cells (Spec, Research, Synthesize, Plan, Plan
 * approval, Build, QA, Fix, Done) and four side lanes for one session's pipeline. Status decides
 * which pipeline a session shows (brief #80); the page only picks the session: the `status.rails`
 * entry of `focus`, or the first rail when no session is focused. A session with no entry (an ended
 * one, or no status yet) has no rail, brief #86: the view is `hidden` and every cell is not started.
 * Every word comes from the rail's stages and the pipeline's reported events (see `describeCell`).
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
	const rail = (focus === null ? status?.rails[0] : status?.rails.find((candidate) => candidate.sessionId === focus)) ?? null;
	if (rail === null || status === null) {
		return {
			phases: SLOTS.map(({ name }): RailCell => ({ name, state: "todo", meta: NOT_STARTED, loop: null })),
			lanes: LANES.map((phase): LaneCell => ({ name: PHASE_LABELS[phase], state: "todo", meta: NOT_STARTED })),
			module: null,
			pipeline: null,
			outside: false,
			hidden: true,
		};
	}

	const projectRoot = status.projectRoot;
	const pipelineEvents = selectPipelineEvents({ events, pipeline: rail.pipeline, sessionId: rail.sessionId });
	const module = findRailModule({ pipelineEvents, projectRoot });
	const ctx: RailContext = { stages: rail.stages, module, sessionId: rail.sessionId, projectRoot, status, pipelineEvents, now };

	return {
		phases: SLOTS.map(({ slot, name }): RailCell => ({ name, ...describeCell({ slot, ctx }) })),
		lanes: LANES.map((phase): LaneCell => ({ name: PHASE_LABELS[phase], ...describeLane({ phase, ctx }) })),
		module,
		pipeline: rail.pipeline,
		outside: rail.outside,
		hidden: false,
	};
}
