import { z } from "zod";
import type { CleanupResult } from "@/types/index.js";
import resolveModule from "./resolveModule/index.js";
import locateEphemerals from "./locateEphemerals/index.js";
import checkPreconditions from "./checkPreconditions/index.js";
import removeEphemerals from "./removeEphemerals/index.js";

export const CleanupInput = z.object({
	path: z
		.string()
		.min(1)
		.describe("The module directory whose ephemerals (plan.aide, todo.aide, brief.aide) to remove, relative to the project root"),
	dryRun: z
		.boolean()
		.default(false)
		.describe("Optional preview that removes nothing; agents closing a module call without it"),
	allowEmptyPlan: z
		.boolean()
		.default(false)
		.describe(
			"Optional; lets a plan.aide that contains no checkboxes pass. It does not override unchecked boxes, a brief.aide with no plan, a todo.aide with no checkboxes, or any other refusal, and has no effect where there is no plan.aide. Off by default",
		),
});

/**
 * Guarded eraser for a closed module's ephemerals. Flow: resolve the module
 * path safely inside the project root, locate which of the three fixed
 * ephemerals exist, check the closure preconditions, then either report what
 * would be removed (dry run) or remove it. The closure check covers both a
 * module with a plan.aide and one without. Every refusal happens before the
 * first unlink, so cleanup is all-or-nothing. A dry run and a real call share
 * every step up to the removal gate, for both kinds of module, which is the
 * dry-run parity guarantee: the preview can never promise what the real call
 * would refuse.
 */
export default async function cleanup(
	root: string,
	input: z.infer<typeof CleanupInput>,
): Promise<CleanupResult> {
	// Resolve the path to a real directory strictly inside the root, or refuse.
	const resolved = await resolveModule(root, input.path);
	if (resolved.kind === "refused") {
		return { kind: "refused", module: resolved.module, refusal: resolved.refusal };
	}
	const { dir, module } = resolved;

	// Find which of the three whitelisted ephemerals exist; never list the directory.
	const located = await locateEphemerals(dir);
	if (located.kind === "refused") {
		return { kind: "refused", module, refusal: located.refusal };
	}
	const { present } = located;

	// Settle every precondition before anything is removed.
	const refusal = await checkPreconditions(dir, present, input.allowEmptyPlan);
	if (refusal) return { kind: "refused", module, refusal };

	// Removal gate: a dry run stops here with exactly what a real call would remove.
	if (input.dryRun) return { kind: "would-remove", module, files: present };

	// Remove in order (plan.aide last); a partial failure is reported, not thrown.
	const outcome = await removeEphemerals(dir, present);
	if (outcome.kind === "incomplete") return { ...outcome, module };
	return { kind: "removed", module, files: outcome.files };
}
