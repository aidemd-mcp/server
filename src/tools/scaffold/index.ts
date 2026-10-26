import { z } from "zod";
import { readdir, rename, mkdir } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import sessionTemplate from "./sessionTemplate/index.js";
import writeIfAbsent from "./writeIfAbsent/index.js";
import resolveSpecFolder from "./resolveSpecFolder/index.js";
import placeRootIntent from "./placeRootIntent/index.js";
import hasIntentSpec from "./hasIntentSpec/index.js";

export const ScaffoldInput = z.object({
	directory: z.string().describe("Directory where the .aide file(s) will be created"),
	type: z
		.enum(["intent", "research", "both", "todo", "plan", "session"])
		.describe(
			"Type of .aide file to create (intent, research, both, todo, plan, or session; session always creates .aide/session.aide at the project root and ignores directory)",
		),
});

const INTENT_TEMPLATE = `---
scope: <module path>
alignment: unreviewed
description: <one-line purpose statement>
intent: >
  <what this module does and the conditions of success>
outcomes:
  desired:
    - <observable success criterion>
  undesired:
    - <failure mode that looks correct but violates the intent>
---

## Context



## Strategy



## Good examples



## Bad examples



## References

`;

const RESEARCH_TEMPLATE = `# Research

## Sources



## Data Points



## Patterns

`;

const TODO_TEMPLATE = `---
status: proposed
description: >
  <one-line summary of what QA found>
---

# QA Re-alignment Document

- [ ]
`;

const PLAN_TEMPLATE = `---
status: proposed
intent: >
  <what this plan achieves and why>
---

## Plan

- [ ]

## Decisions

`;

/** List existing .aide files in a directory; directories (such as the .aide methodology folder) are never spec files. */
async function existingAideFiles(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".aide")).map((entry) => entry.name);
	} catch {
		return [];
	}
}

/** The report line for a target that already exists and was left untouched. */
function skippedLine(name: string): string {
	return `Skipped ${name} — it already exists and was left untouched`;
}

/**
 * Create new .aide files with correct naming conventions.
 * No type ever overwrites or deletes: an existing target is reported as a
 * Skipped line and left untouched.
 * New files start with their kind's starting value, and scaffold never changes a value afterwards.
 * Handles auto-rename logic:
 * - type=intent + no research.aide → creates .aide
 * - type=intent + research.aide exists → creates intent.aide
 * - type=intent + the folder already holds .aide or intent.aide → skips
 * - type=intent in the project's .aide folder (directory ".aide" or ".") → always intent.aide;
 *   a bare .aide there with no intent.aide is renamed to intent.aide, content kept;
 *   intent.aide present → skips
 * - type=research → creates research.aide; renames existing .aide to intent.aide
 *   (no rename when research.aide already exists)
 * - type=both → creates research.aide + intent.aide
 * - type=todo → creates todo.aide
 * - type=plan → creates plan.aide
 * - type=plan with no .aide or intent.aide in the folder → refused, nothing created
 * - type=session → creates .aide/session.aide at the project root, ignoring directory
 * - type=intent, research and both treat "." as the project's .aide folder
 */
export default async function scaffold(
	root: string,
	directory: string,
	type: z.infer<typeof ScaffoldInput>["type"],
): Promise<string> {
	if (type === "session") {
		// The session record has one fixed location, so the passed directory is never created, listed or touched.
		await mkdir(join(root, ".aide"), { recursive: true });
		const outcome = await writeIfAbsent(join(root, ".aide", "session.aide"), sessionTemplate);
		if (outcome === "exists") return skippedLine(".aide/session.aide");
		return "Created .aide/session.aide";
	}

	const usesSpecFolder = type === "intent" || type === "research" || type === "both";
	const { folder, holdsRootSpec } = resolveSpecFolder({ root, directory });
	const dir = usesSpecFolder ? folder : isAbsolute(directory) ? directory : join(root, directory);

	// A plan implements a spec, so the gate runs before mkdir: a refusal creates nothing, not even the folder.
	if (type === "plan" && !hasIntentSpec(await existingAideFiles(dir))) {
		return `Refused plan.aide — ${directory} holds no intent spec (.aide or intent.aide); write the folder's intent spec first, then scaffold the plan`;
	}

	// Ensure directory exists
	await mkdir(dir, { recursive: true });

	const existing = await existingAideFiles(dir);
	const actions: string[] = [];

	if (type === "todo") {
		const outcome = await writeIfAbsent(join(dir, "todo.aide"), TODO_TEMPLATE);
		actions.push(outcome === "exists" ? skippedLine("todo.aide") : "Created todo.aide");
	} else if (type === "plan") {
		const outcome = await writeIfAbsent(join(dir, "plan.aide"), PLAN_TEMPLATE);
		actions.push(outcome === "exists" ? skippedLine("plan.aide") : "Created plan.aide");
	} else if (type === "intent" && holdsRootSpec) {
		const outcome = await placeRootIntent({ folder: dir, existing, template: INTENT_TEMPLATE });
		if (outcome === "created") {
			actions.push("Created .aide/intent.aide (the project root intent spec always takes the explicit name)");
		} else if (outcome === "renamed") {
			actions.push(
				"Renamed .aide/.aide → .aide/intent.aide (the project root intent spec always takes the explicit name; its content is kept)",
			);
		} else actions.push(skippedLine(".aide/intent.aide"));
	} else if (type === "intent") {
		const researchExists = existing.includes("research.aide");
		const name = researchExists ? "intent.aide" : ".aide";
		const otherName = researchExists ? ".aide" : "intent.aide";
		if (existing.includes(name)) {
			actions.push(skippedLine(name));
		} else if (existing.includes(otherName)) {
			actions.push(
				`Skipped ${name} — ${otherName} already holds this folder's intent spec and was left untouched`,
			);
		} else {
			const outcome = await writeIfAbsent(join(dir, name), INTENT_TEMPLATE);
			if (outcome === "exists") actions.push(skippedLine(name));
			else if (researchExists) {
				actions.push("Created intent.aide (research.aide exists, so using explicit name)");
			} else actions.push("Created .aide");
		}
	} else if (type === "research") {
		if (existing.includes("research.aide")) {
			actions.push(skippedLine("research.aide"));
		} else {
			// If .aide exists, rename to intent.aide first
			if (existing.includes(".aide") && !existing.includes("intent.aide")) {
				await rename(join(dir, ".aide"), join(dir, "intent.aide"));
				actions.push("Renamed .aide → intent.aide");
			}
			const outcome = await writeIfAbsent(join(dir, "research.aide"), RESEARCH_TEMPLATE);
			actions.push(outcome === "exists" ? skippedLine("research.aide") : "Created research.aide");
		}
	} else if (type === "both") {
		if (existing.includes("intent.aide")) {
			actions.push(skippedLine("intent.aide"));
		} else if (existing.includes(".aide")) {
			// .aide becomes the explicit intent.aide since research is being introduced
			await rename(join(dir, ".aide"), join(dir, "intent.aide"));
			actions.push("Renamed .aide → intent.aide");
		} else {
			const outcome = await writeIfAbsent(join(dir, "intent.aide"), INTENT_TEMPLATE);
			actions.push(outcome === "exists" ? skippedLine("intent.aide") : "Created intent.aide");
		}
		if (existing.includes("research.aide")) {
			actions.push(skippedLine("research.aide"));
		} else {
			const outcome = await writeIfAbsent(join(dir, "research.aide"), RESEARCH_TEMPLATE);
			actions.push(outcome === "exists" ? skippedLine("research.aide") : "Created research.aide");
		}
	}

	if (actions.length === 0) return "No changes needed — files already exist.";
	return actions.join("\n");
}
