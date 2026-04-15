import { z } from "zod";
import { readdir, writeFile, rename, mkdir } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

export const ScaffoldInput = z.object({
	directory: z.string().describe("Directory where the .aide file(s) will be created"),
	type: z
		.enum(["intent", "research", "both", "todo", "plan"])
		.describe("Type of .aide file to create (intent, research, both, todo, or plan)"),
});

const INTENT_TEMPLATE = `---
scope: <module path>
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
description: >
  <one-line summary of what QA found>
---

# QA Re-alignment Document

- [ ]
`;

const PLAN_TEMPLATE = `---
description: >
  <one-line summary of what this plan implements>
intent: >
  <what this plan achieves and why>
---

## Plan

- [ ]

## Decisions

`;

/** List existing .aide files in a directory. */
async function existingAideFiles(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir);
		return entries.filter((name) => name.endsWith(".aide"));
	} catch {
		return [];
	}
}

/**
 * Create new .aide files with correct naming conventions.
 * Handles auto-rename logic:
 * - type=intent + no research.aide → creates .aide
 * - type=intent + research.aide exists → creates intent.aide
 * - type=research → creates research.aide; renames existing .aide to intent.aide
 * - type=both → creates research.aide + intent.aide
 * - type=todo → creates todo.aide
 * - type=plan → creates plan.aide
 */
export default async function scaffold(
	root: string,
	directory: string,
	type: "intent" | "research" | "both" | "todo" | "plan",
): Promise<string> {
	const dir = isAbsolute(directory) ? directory : join(root, directory);

	// Ensure directory exists
	await mkdir(dir, { recursive: true });

	const existing = await existingAideFiles(dir);
	const actions: string[] = [];

	if (type === "todo") {
		const target = join(dir, "todo.aide");
		await writeFile(target, TODO_TEMPLATE, "utf-8");
		actions.push("Created todo.aide");
	} else if (type === "plan") {
		const target = join(dir, "plan.aide");
		await writeFile(target, PLAN_TEMPLATE, "utf-8");
		actions.push("Created plan.aide");
	} else if (type === "intent") {
		if (existing.includes("research.aide")) {
			const target = join(dir, "intent.aide");
			await writeFile(target, INTENT_TEMPLATE, "utf-8");
			actions.push("Created intent.aide (research.aide exists, so using explicit name)");
		} else {
			const target = join(dir, ".aide");
			await writeFile(target, INTENT_TEMPLATE, "utf-8");
			actions.push("Created .aide");
		}
	} else if (type === "research") {
		// If .aide exists, rename to intent.aide first
		if (existing.includes(".aide") && !existing.includes("intent.aide")) {
			await rename(join(dir, ".aide"), join(dir, "intent.aide"));
			actions.push("Renamed .aide → intent.aide");
		}
		const target = join(dir, "research.aide");
		await writeFile(target, RESEARCH_TEMPLATE, "utf-8");
		actions.push("Created research.aide");
	} else if (type === "both") {
		// If .aide exists, remove it since we're creating intent.aide
		if (existing.includes(".aide") && !existing.includes("intent.aide")) {
			await rename(join(dir, ".aide"), join(dir, "intent.aide"));
			actions.push("Renamed .aide → intent.aide");
		} else if (!existing.includes("intent.aide")) {
			await writeFile(join(dir, "intent.aide"), INTENT_TEMPLATE, "utf-8");
			actions.push("Created intent.aide");
		}
		if (!existing.includes("research.aide")) {
			await writeFile(join(dir, "research.aide"), RESEARCH_TEMPLATE, "utf-8");
			actions.push("Created research.aide");
		}
	}

	if (actions.length === 0) return "No changes needed — files already exist.";
	return actions.join("\n");
}
