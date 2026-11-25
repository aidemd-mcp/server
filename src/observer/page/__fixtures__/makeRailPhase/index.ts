import type { Phase, RailPhase } from "@/types/index.js";

/** One rail stage in the given state; `rest` carries a running stage's `buildStep` or `qaFixRound`, or a skipped stage's `reason`. */
export default function makeRailPhase({ phase, state, ...rest }: { phase: Phase; state: RailPhase["state"] } & Partial<Pick<RailPhase, "buildStep" | "qaFixRound" | "reason">>): RailPhase {
	return { phase, label: phase, state, ...rest };
}
