import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import type { InitStep } from "@/types/index.js";

/**
 * Apply mode writer — turns a plan into disk state and returns the manifest
 * the agent reports to the user.
 *
 * For each step:
 * - `"would-create"` / `"would-overwrite"` file steps (no `prescription` field,
 *   not a brain vault step): creates parent directories and writes `content` to
 *   `filePath`. Returns the step with `status` changed to `"created"` (for
 *   `"would-create"`) or `"overwritten"` (for `"would-overwrite"`) and `content`
 *   removed.
 * - `"would-create"` / `"would-overwrite"` brain vault steps (category `"brain"`)
 *   — two sub-types:
 *   - **Directory step** (`filePath` has no extension): parses `content` as a
 *     JSON array of directory names, creates each under `filePath` with
 *     `recursive: true`. Returns with `status: "created"` or `"overwritten"` and
 *     `content` removed.
 *   - **File step** (`filePath` has a file extension, e.g. `.md`): creates the
 *     parent directory and writes `content` to `filePath`. Used for content
 *     templates such as the playbook hub and vault CLAUDE.md. Returns with
 *     `status: "created"` or `"overwritten"` and `content` removed.
 * - `"would-create"` / `"would-overwrite"` steps with a `prescription` field
 *   (MCP steps): passed through unchanged — the agent merges prescriptions
 *   itself. Never written by this helper.
 * - `"would-create"` / `"would-overwrite"` IDE VS Code steps (name contains
 *   "VS Code"): passed through unchanged — requires the external `code` CLI.
 *   The agent executes the extension install command.
 * - `"exists"`, `"would-skip"` steps: passed through unchanged.
 * - `"created"`, `"overwritten"` steps (already applied): passed through
 *   unchanged (idempotent).
 *
 * The `prescription` field is never stripped — MCP steps keep their
 * prescription so the agent can perform the merge.
 */
export default async function applySteps(steps: InitStep[]): Promise<InitStep[]> {
	return Promise.all(steps.map(applyStep));
}

async function applyStep(step: InitStep): Promise<InitStep> {
	// Only act on steps that need a write; all other statuses pass through unchanged
	if (step.status !== "would-create" && step.status !== "would-overwrite") {
		return step;
	}

	// Determine the execution status that corresponds to this planning status
	const writtenStatus = step.status === "would-overwrite" ? "overwritten" : "created";

	// MCP steps carry a prescription — the agent merges them; never written here
	if (step.prescription !== undefined) {
		return step;
	}

	// IDE VS Code steps require the external `code` CLI — pass through with
	// instructions so the agent knows what command to run
	if (step.category === "ide" && step.name.includes("VS Code")) {
		return { ...step, instructions: `code --install-extension ${step.filePath}` };
	}

	// Brain step — two sub-types distinguished by whether filePath has an extension
	if (step.category === "brain") {
		if (!step.content) {
			// No content means placeholder (filePath is empty string) — pass through
			return step;
		}
		if (extname(step.filePath)) {
			// File step — content is a template destined for a specific file path
			await mkdir(dirname(step.filePath), { recursive: true });
			await writeFile(step.filePath, step.content, "utf-8");
		} else {
			// Directory step — content is a JSON array of subdirectory names to create
			const dirs: string[] = JSON.parse(step.content);
			await Promise.all(
				dirs.map((dir) => mkdir(`${step.filePath}/${dir}`, { recursive: true })),
			);
		}
		const { content: _content, ...rest } = step;
		return { ...rest, status: writtenStatus };
	}

	// Regular file step — write content to filePath
	if (step.content !== undefined) {
		await mkdir(dirname(step.filePath), { recursive: true });
		await writeFile(step.filePath, step.content, "utf-8");
		const { content: _content, ...rest } = step;
		return { ...rest, status: writtenStatus };
	}

	// No content and not a special case — pass through unchanged
	return step;
}
