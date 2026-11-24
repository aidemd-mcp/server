import type { IconName, PlanRowModel } from "@/observer/page/types/index.js";

/** The status badge per reported plan status (a plan's status word, tone and icon); an unset status reads `No status`. */
const PLAN_STATUS_LOOK: Record<string, { word: string; tone: PlanRowModel["tone"]; icon: IconName }> = {
	proposed: { word: "Proposed", tone: "warn", icon: "gate" },
	approved: { word: "Approved", tone: "run", icon: "run" },
	completed: { word: "Completed", tone: "done", icon: "done" },
	abandoned: { word: "Abandoned", tone: "outline", icon: "close" },
	unset: { word: "No status", tone: "outline", icon: "todo" },
};

export default PLAN_STATUS_LOOK;
