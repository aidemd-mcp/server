import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { UpgradeFileResult } from "@/types/index.js";

/**
 * Apply mode writer for aide_upgrade — turns comparison results into disk state
 * and returns the manifest the agent reports to the user.
 *
 * Dispatch logic per file:
 *
 * - `"differs"` or `"missing"`, NOT mcp category, NOT VS Code IDE:
 *   Creates parent directories and writes `canonicalContent` to `filePath`.
 *   Returns the result with `status` changed to `"updated"` (was differs) or
 *   `"created"` (was missing), and `canonicalContent` stripped.
 *
 * - `"differs"` or `"missing"`, mcp category:
 *   Passed through unchanged with `prescription` intact — the agent merges
 *   prescriptions into the existing MCP config itself. Never written here.
 *
 * - `"differs"` IDE VS Code step (name contains "VS Code"):
 *   Passed through with `instructions` field set to
 *   `code --install-extension <filePath>`. The VS Code CLI is required for
 *   extension installs — the MCP server cannot invoke it. No disk write.
 *
 * - `"differs"` or `"missing"` IDE Zed step:
 *   Has `canonicalContent` — written to disk normally via the regular file path.
 *
 * - `"matches"`:
 *   Returned as `"unchanged"` — already current, no write needed. This maps
 *   the dry-run vocabulary to the apply-mode terminal vocabulary defined in
 *   the spec (`"updated"`, `"created"`, `"unchanged"`).
 *
 * - `"malformed"`, `"updated"`, `"created"`, `"unchanged"`:
 *   Passed through unchanged — no action available or already applied.
 */
export default async function applyFiles(files: UpgradeFileResult[]): Promise<UpgradeFileResult[]> {
	return Promise.all(files.map(applyFile));
}

async function applyFile(file: UpgradeFileResult): Promise<UpgradeFileResult> {
	// Files that already match canonical are reported as "unchanged" in apply output
	if (file.status === "matches") {
		return { ...file, status: "unchanged" };
	}

	// Only act on files that need writing — differs or missing
	if (file.status !== "differs" && file.status !== "missing") {
		return file;
	}

	// MCP files carry a prescription — the agent merges them; never written here
	if (file.category === "mcp") {
		return file;
	}

	// IDE VS Code steps require the external `code` CLI — pass through with
	// instructions so the agent knows what command to run
	if (file.category === "ide" && file.name.includes("VS Code")) {
		return { ...file, instructions: `code --install-extension ${file.filePath}` };
	}

	// Regular file step (including IDE Zed) — write canonicalContent to filePath
	if (file.canonicalContent !== undefined) {
		await mkdir(dirname(file.filePath), { recursive: true });
		await writeFile(file.filePath, file.canonicalContent, "utf-8");
		// Strip canonicalContent; map comparison status to execution status
		const { canonicalContent: _content, ...rest } = file;
		return { ...rest, status: file.status === "differs" ? "updated" : "created" };
	}

	// No content and not a special case — pass through unchanged
	return file;
}
