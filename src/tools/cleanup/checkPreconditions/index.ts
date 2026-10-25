import { readFile } from "node:fs/promises";
import { join } from "node:path";
import readGovernedValue from "@/tools/frontmatter/readGovernedValue/index.js";
import type { CleanupEphemeral, CleanupRefusal, OpenCheckbox } from "@/types/index.js";
import judgeEphemeral, { type EphemeralVerdict } from "../judgeEphemeral/index.js";

/** The open items a verdict carries, or none for the verdicts that name no items. */
function itemsOf(verdict: EphemeralVerdict): OpenCheckbox[] {
	return "items" in verdict ? verdict.items : [];
}

/** True when the plan's own frontmatter records `status: abandoned`; only then does the plan take its brief with it unjudged. */
function isAbandoned(content: string): boolean {
	const read = readGovernedValue({ content, kind: "plan" });
	return read.status === "ok" && read.current.state === "set" && read.current.value === "abandoned";
}

/** Reads one present ephemeral once and judges it by its own recorded status. */
async function judgeFile(dir: string, file: CleanupEphemeral): Promise<{ content: string; verdict: EphemeralVerdict }> {
	const content = await readFile(join(dir, file), "utf-8");
	return { content, verdict: judgeEphemeral({ file, content }) };
}

/**
 * The closure gate: decides whether a module's ephemerals may be removed.
 * Returns the first refusal that applies, or `null` when removal may proceed.
 * Each present file is read once and judged on the status in its own frontmatter
 * (see `judgeEphemeral`); this function only combines the per-file verdicts.
 *
 * An unreadable status (invalid value or unparsable frontmatter) in the plan,
 * todo or brief, in that order, refuses first. A brief beside an abandoned plan
 * is not judged at all: an abandoned plan takes its brief whatever it records.
 *
 * Without a plan.aide, a brief is refused whatever either file records, and a
 * todo.aide alone is closed by its own verdict. With a plan.aide, first match
 * wins: any file recorded proposed or approved refuses as `open-status`; a file
 * recorded completed that still has unchecked items refuses; a status-less plan
 * with no checkboxes refuses; a status-less file with unchecked items refuses;
 * otherwise removal proceeds. A missing todo never blocks, and a status-less
 * todo with no checkboxes beside a plan is closed.
 */
export default async function checkPreconditions(
	dir: string,
	present: CleanupEphemeral[],
): Promise<CleanupRefusal | null> {
	// Nothing to remove; nothing is read.
	if (present.length === 0) return { kind: "no-ephemerals" };

	const plan = present.includes("plan.aide") ? await judgeFile(dir, "plan.aide") : null;
	const todo = present.includes("todo.aide") ? await judgeFile(dir, "todo.aide") : null;
	const briefIsTaken = plan !== null && isAbandoned(plan.content);
	const brief = present.includes("brief.aide") && !briefIsTaken ? await judgeFile(dir, "brief.aide") : null;

	const judged = [
		{ file: "plan.aide" as const, verdict: plan?.verdict },
		{ file: "todo.aide" as const, verdict: todo?.verdict },
		{ file: "brief.aide" as const, verdict: brief?.verdict },
	];
	for (const { file, verdict } of judged) {
		if (verdict?.verdict === "invalid-status") return { kind: "invalid-status", file, detail: verdict.detail };
	}

	if (!plan) {
		// A brief goes only with its plan; any todo items ride along so the refusal hides no remaining work.
		if (present.includes("brief.aide")) return { kind: "brief-without-plan", items: todo ? itemsOf(todo.verdict) : [] };

		// Only todo.aide is present, so its own verdict decides.
		switch (todo!.verdict.verdict) {
			case "closed":
				return null;
			case "open-status":
				return {
					kind: "open-status",
					files: [{ file: "todo.aide", status: todo!.verdict.status }],
					items: todo!.verdict.items,
				};
			case "completed-open":
				return { kind: "completed-with-open-items", items: todo!.verdict.items };
			case "no-status-empty":
				return { kind: "todo-without-checkboxes" };
			case "no-status-open":
				return { kind: "unchecked-items", items: todo!.verdict.items };
			case "invalid-status":
				throw new Error("invalid-status verdicts are refused before this point");
		}
	}

	const verdicts = judged.flatMap(({ file, verdict }) => (verdict ? [{ file, verdict }] : []));

	const openFiles = verdicts.flatMap(({ file, verdict }) =>
		verdict.verdict === "open-status" ? [{ file, status: verdict.status }] : [],
	);
	if (openFiles.length > 0) {
		// Plan items first, then todo items; a brief's items are never scanned.
		const items = [plan, todo].flatMap((judgedFile) => (judgedFile ? itemsOf(judgedFile.verdict) : []));
		return { kind: "open-status", files: openFiles, items };
	}

	const completedOpen = verdicts.flatMap(({ verdict }) => (verdict.verdict === "completed-open" ? verdict.items : []));
	if (completedOpen.length > 0) return { kind: "completed-with-open-items", items: completedOpen };

	if (plan.verdict.verdict === "no-status-empty") return { kind: "plan-without-checkboxes" };

	const uncheckedItems = verdicts.flatMap(({ verdict }) => (verdict.verdict === "no-status-open" ? verdict.items : []));
	if (uncheckedItems.length > 0) return { kind: "unchecked-items", items: uncheckedItems };

	return null;
}
