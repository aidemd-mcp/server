import type { Phase } from "../../types/index.js";

/**
 * Display label for every pipeline phase. Key order is the closed phase list's
 * order, which the phase rail follows; `satisfies` makes a phase missing here
 * a compile error.
 */
const PHASE_LABELS = {
	spec: "Spec",
	research: "Research",
	synthesize: "Synthesize",
	structure: "Structure",
	plan: "Plan",
	build: "Build",
	qa: "QA",
	fix: "Fix",
	align: "Align",
	refactor: "Refactor",
	cleanup: "Cleanup",
} as const satisfies Record<Phase, string>;

export default PHASE_LABELS;
