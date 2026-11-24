import type { Status } from "@/types/index.js";
import type { StepSource } from "@/observer/page/types/index.js";
import normalizeModule from "@/observer/page/SessionView/normalizeModule/index.js";

/**
 * Where the running Build step's own words live: the plan file of the module the followed
 * session's Build is on (else the first running work, as the now card picks it) and the step it has
 * reached. Null when nothing runs, the work is not a Build that reported its step, or the module
 * lists no plan file.
 */
export default function findStepSource({ status, focus }: { status: Status | null; focus: string }): StepSource | null {
	const work = status?.running.find((candidate) => candidate.sessionId === focus) ?? status?.running[0];
	if (status === null || work === undefined || work.phase !== "build" || work.buildStep === undefined) return null;
	const folder = normalizeModule({ projectRoot: status.projectRoot, module: work.module });
	const plan = status.tree.find((node) => node.folder === folder)?.files.find((file) => file.kind === "plan");
	return plan === undefined ? null : { file: plan.file, step: work.buildStep.reached };
}
