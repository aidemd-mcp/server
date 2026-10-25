import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import findOpenItems from "@/tools/cleanup/findOpenItems/index.js";
import readGovernedValue from "../readGovernedValue/index.js";
import type { FrontmatterRefusal, GovernedKind } from "../types/index.js";

/** Names the sibling plan's state for the refusal text: `missing`, `not set`, the invalid raw value in quotes, or its value. */
function describePlanState(planContent: string | null): string {
	if (planContent === null) return "missing";
	const read = readGovernedValue({ content: planContent, kind: "plan" });
	if (read.status === "unparsable") return `"${read.detail}"`;
	if (read.current.state === "set") return read.current.value;
	if (read.current.state === "invalid") return `"${read.current.raw}"`;
	return "not set";
}

/** Reads the plan beside a brief; ENOENT is a missing plan, any other fs error propagates. */
async function readSiblingPlan(absPath: string): Promise<string | null> {
	try {
		return await readFile(join(dirname(absPath), "plan.aide"), "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

/**
 * Guards the move to `completed`; the orchestrator calls it only when the
 * requested value is `completed`. Refuses with the open items when the file
 * still has unchecked checkboxes, judged by cleanup's own scanner so the tool
 * and cleanup never disagree. A brief is also refused unless the `plan.aide`
 * beside it is already completed. Returns null when completion may proceed.
 */
export default async function checkCompletion({
	absPath,
	content,
	kind,
}: {
	absPath: string;
	content: string;
	kind: GovernedKind;
}): Promise<FrontmatterRefusal | null> {
	// Every unchecked checkbox blocks completion, for all kinds.
	const { open } = findOpenItems(content);
	if (open.length > 0) return { kind: "open-items", items: open };

	if (kind !== "brief") return null;

	// A brief is completed only after its plan: read the plan in the same folder.
	const planContent = await readSiblingPlan(absPath);
	if (planContent !== null) {
		const read = readGovernedValue({ content: planContent, kind: "plan" });
		if (read.status === "ok" && read.current.state === "set" && read.current.value === "completed") return null;
	}
	return { kind: "plan-not-completed", plan: describePlanState(planContent) };
}
