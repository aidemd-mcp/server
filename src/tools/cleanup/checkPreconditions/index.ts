import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CheckedEphemeral, CleanupEphemeral, CleanupRefusal, OpenCheckbox } from "@/types/index.js";
import findOpenItems from "../findOpenItems/index.js";

/** Reads one checkbox-bearing ephemeral and tags each unchecked item with the file it sits in. */
async function scanFile(dir: string, file: CheckedEphemeral) {
	const { total, open } = findOpenItems(await readFile(join(dir, file), "utf-8"));
	const items: OpenCheckbox[] = open.map(({ line, text }) => ({ file, line, text }));
	return { total, items };
}

/**
 * The closure gate: decides whether a module's ephemerals may be removed.
 * Returns the first refusal that applies, or `null` when removal may proceed.
 * Reads only plan.aide and todo.aide (brief.aide has no checkbox contract), and
 * only after the cheap `no-plan` check passes. `allowEmptyPlan` is consulted in
 * exactly one branch: it lifts `plan-without-checkboxes` and nothing else.
 */
export default async function checkPreconditions(
	dir: string,
	present: CleanupEphemeral[],
	allowEmptyPlan: boolean,
): Promise<CleanupRefusal | null> {
	// No plan means the module's cycle cannot be shown closed; nothing is read.
	if (!present.includes("plan.aide")) return { kind: "no-plan" };

	const plan = await scanFile(dir, "plan.aide");
	// A plan with no checkboxes gives no evidence of completion unless the caller opted in.
	if (plan.total === 0 && !allowEmptyPlan) return { kind: "plan-without-checkboxes" };

	// A missing todo.aide is never read and never blocks; a todo with zero checkboxes is allowed.
	const todo = present.includes("todo.aide") ? await scanFile(dir, "todo.aide") : null;

	// Plan items first, then todo items, each in line order.
	const items = [...plan.items, ...(todo?.items ?? [])];
	if (items.length > 0) return { kind: "unchecked-items", items };

	return null;
}
