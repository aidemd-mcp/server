import type { Phase, RailPhase } from "@/types/index.js";

/** One rail phase entry in the given state; `rest` carries a running entry's `buildStep` or `qaFixRound`. */
export default function makeRailPhase({ phase, state, ...rest }: { phase: Phase; state: RailPhase["state"] } & Partial<Pick<RailPhase, "buildStep" | "qaFixRound">>): RailPhase {
	return { phase, label: phase, state, ...rest };
}
