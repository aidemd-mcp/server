import type { RunningWork } from "@/types/index.js";

/** True for the Fix phase and for QA from its second round on: the loop the red fix card stands for. */
export default function isFixRound({ work }: { work: Pick<RunningWork, "phase" | "qaFixRound"> }): boolean {
	return work.phase === "fix" || (work.phase === "qa" && (work.qaFixRound ?? 0) >= 2);
}
