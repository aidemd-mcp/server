import type { Status } from "@/types/index.js";

/** The numbered steps of the module's plan.aide that the status reports done and in total, or null when the file is absent or unreadable. */
export default function findPlanSteps({ status, module }: { status: Status | null; module: string }): { done: number; total: number } | null {
	const plan = status?.tree.find((node) => node.folder === module)?.files.find((file) => file.kind === "plan");
	if (plan?.kind !== "plan" || plan.read.state !== "present") return null;
	return plan.read.steps;
}
