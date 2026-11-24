import type { RailCellDescription, RailContext, RailSlot } from "@/observer/page/types/index.js";
import describeApproval from "./describeApproval/index.js";
import describeDone from "./describeDone/index.js";
import describePhase from "./describePhase/index.js";
import describeQa from "./describeQa/index.js";

/**
 * One of the rail's nine cells in words: its state and its meta line, from what the observer
 * reported for the rail's module and session. Plan approval and Done are not phases, so they read
 * from the gate and verdict events; QA overlays its verdict on the phase; every other cell is its
 * phase as the observer's rail reports it. Nothing here is worked out beyond a reported event, and
 * no cell is ever `skipped`.
 */
export default function describeCell({ slot, ctx }: { slot: RailSlot; ctx: RailContext }): RailCellDescription {
	if (slot === "approval") return describeApproval({ ctx });
	if (slot === "done") return describeDone({ ctx });
	if (slot === "qa") return describeQa({ ctx });
	return describePhase({ phase: slot, ctx });
}
