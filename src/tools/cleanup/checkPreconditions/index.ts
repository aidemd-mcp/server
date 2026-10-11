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
 * Reads only plan.aide and todo.aide; brief.aide's own checkboxes are never read.
 *
 * With a plan.aide, the plan proves closure: `allowEmptyPlan` lifts only
 * `plan-without-checkboxes`, and any unchecked plan or todo item refuses.
 * Without a plan.aide, a fully checked todo.aide is its own proof of closure.
 * A brief.aide is never removed without its plan, and a todo.aide with no
 * checkboxes proves nothing, so both refuse. `allowEmptyPlan` has no effect there.
 */
export default async function checkPreconditions(
	dir: string,
	present: CleanupEphemeral[],
	allowEmptyPlan: boolean,
): Promise<CleanupRefusal | null> {
	// Nothing to remove; nothing is read.
	if (present.length === 0) return { kind: "no-ephemerals" };

	if (!present.includes("plan.aide")) {
		// todo.aide is the only checkbox-bearing file left, so it is the only one scanned.
		const todo = present.includes("todo.aide") ? await scanFile(dir, "todo.aide") : null;

		// A brief has no checkboxes to show its cycle closed; it goes only with its plan.
		// Any unchecked todo items ride along so the refusal hides no remaining work.
		if (present.includes("brief.aide")) return { kind: "brief-without-plan", items: todo?.items ?? [] };

		// Only todo.aide is present: no boxes proves nothing, open boxes block, all checked passes.
		if (todo!.total === 0) return { kind: "todo-without-checkboxes" };
		if (todo!.items.length > 0) return { kind: "unchecked-items", items: todo!.items };
		return null;
	}

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
