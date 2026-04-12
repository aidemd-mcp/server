import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { UpgradeFileResult } from "@/types/index.js";

const execFileAsync = promisify(execFile);

/** Read a file, returning undefined if it does not exist. */
async function safeReadFile(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return undefined;
	}
}

/**
 * Compare the Zed `*.aide` file-type association against canonical.
 * Read-only — never writes.
 *
 * Returns an `UpgradeFileResult` with category `"ide"`:
 * - `"malformed"` when `.zed/settings.json` exists but is not valid JSON.
 * - `"missing"` when the settings file does not exist.
 * - `"matches"` when `*.aide` is already in `file_types.Markdown`.
 * - `"differs"` when the file exists but the association is absent.
 *   `canonicalContent` is the full settings file with the association merged in.
 */
export async function checkZedConfig(projectRoot: string): Promise<UpgradeFileResult> {
	const name = "Zed config";
	const settingsPath = join(projectRoot, ".zed", "settings.json");
	const existing = await safeReadFile(settingsPath);

	if (existing !== undefined) {
		let settings: Record<string, unknown>;
		try {
			settings = JSON.parse(existing) as Record<string, unknown>;
		} catch {
			return {
				name,
				filePath: settingsPath,
				status: "malformed",
				category: "ide",
			};
		}

		const mdTypes: string[] = (settings.file_types as Record<string, string[]>)?.Markdown ?? [];

		if (mdTypes.includes("*.aide")) {
			return {
				name,
				filePath: settingsPath,
				status: "matches",
				category: "ide",
			};
		}

		// Merge the association and return the full content for the agent.
		const merged = {
			...settings,
			file_types: {
				...((settings.file_types as Record<string, unknown>) ?? {}),
				Markdown: [...mdTypes, "*.aide"],
			},
		};
		return {
			name,
			filePath: settingsPath,
			status: "differs",
			category: "ide",
			canonicalContent: JSON.stringify(merged, null, 2) + "\n",
		};
	}

	// Settings file absent — canonical is a fresh file with the association.
	const canonical = { file_types: { Markdown: ["*.aide"] } };
	return {
		name,
		filePath: settingsPath,
		status: "missing",
		category: "ide",
		canonicalContent: JSON.stringify(canonical, null, 2) + "\n",
	};
}

/**
 * Check whether the VS Code aide-markdown extension is installed.
 * Read-only — never installs.
 *
 * Returns an `UpgradeFileResult` with category `"ide"`:
 * - `"matches"` when the extension is already installed or the `code` CLI is
 *   unavailable (cannot determine state).
 * - `"differs"` when the extension is not installed and can be installed.
 *   `canonicalContent` is the absolute path to the bundled `.vsix` file.
 */
export async function checkVscodeExtension(): Promise<UpgradeFileResult> {
	const name = "VS Code extension";
	const moduleDir = dirname(fileURLToPath(import.meta.url));
	const vsixPath = join(moduleDir, "..", "..", "..", "..", "extensions", "vscode", "aide-markdown-0.0.1.vsix");

	// Ensure `code` CLI is available.
	try {
		await execFileAsync("code", ["--version"]);
	} catch {
		return {
			name,
			filePath: vsixPath,
			status: "matches",
			category: "ide",
		};
	}

	// Check installation state.
	let installed: boolean;
	try {
		const { stdout } = await execFileAsync("code", ["--list-extensions"]);
		installed = stdout.toLowerCase().includes("aide-markdown");
	} catch {
		return {
			name,
			filePath: vsixPath,
			status: "matches",
			category: "ide",
		};
	}

	if (installed) {
		return {
			name,
			filePath: vsixPath,
			status: "matches",
			category: "ide",
		};
	}

	return {
		name,
		filePath: vsixPath,
		status: "differs",
		category: "ide",
		canonicalContent: vsixPath,
	};
}
