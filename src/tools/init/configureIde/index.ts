import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InitStep } from "@/types/index.js";

const execFileAsync = promisify(execFile);

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Inspect Zed settings and return a planning step for .aide file association.
 *
 * Returns `exists` when the `*.aide` entry is already in `.zed/settings.json`.
 * Returns `would-create` with the full patched settings JSON as `content`
 * when the entry is absent.
 *
 * This function never writes to disk — it is a planner only.
 */
export async function configureZed(projectRoot: string): Promise<InitStep> {
	const settingsPath = join(projectRoot, ".zed", "settings.json");
	const filePath = settingsPath;
	const existing = await safeReadFile(settingsPath);

	if (existing) {
		try {
			const settings = JSON.parse(existing);
			const fileTypes = settings.file_types || {};
			const mdTypes: string[] = fileTypes.Markdown || [];

			if (mdTypes.includes("*.aide")) {
				return {
					name: "Zed config",
					status: "exists",
					category: "ide",
					filePath,
				};
			}

			mdTypes.push("*.aide");
			fileTypes.Markdown = mdTypes;
			settings.file_types = fileTypes;

			return {
				name: "Zed config",
				status: "would-create",
				category: "ide",
				filePath,
				content: JSON.stringify(settings, null, 2) + "\n",
			};
		} catch {
			return {
				name: "Zed config",
				status: "would-skip",
				category: "ide",
				filePath,
			};
		}
	}

	const settings = { file_types: { Markdown: ["*.aide"] } };
	return {
		name: "Zed config",
		status: "would-create",
		category: "ide",
		filePath,
		content: JSON.stringify(settings, null, 2) + "\n",
	};
}

/**
 * Check VS Code extension installation status and return a planning step.
 *
 * Returns `exists` when the aide-markdown extension is already installed.
 * Returns `would-skip` when `code` CLI is unavailable or the .vsix is missing
 * (the agent will install when confirmed).
 *
 * This function never writes to disk — it is a planner only.
 */
export async function configureVscode(extensionsDir: string): Promise<InitStep> {
	const vsixPath = resolve(extensionsDir, "aide-markdown-0.0.1.vsix");
	// filePath points to the vsix — not a file the agent writes, but a meaningful
	// path for the agent to display when reporting extension installation.
	const filePath = vsixPath;

	// Check if `code` CLI is on PATH
	try {
		await execFileAsync("code", ["--version"]);
	} catch {
		return {
			name: "VS Code extension",
			status: "would-skip",
			category: "ide",
			filePath,
		};
	}

	// Check if already installed
	try {
		const { stdout } = await execFileAsync("code", ["--list-extensions"]);
		if (stdout.toLowerCase().includes("aide-markdown")) {
			return {
				name: "VS Code extension",
				status: "exists",
				category: "ide",
				filePath,
			};
		}
	} catch {
		return {
			name: "VS Code extension",
			status: "would-skip",
			category: "ide",
			filePath,
		};
	}

	// Check if the .vsix is present
	try {
		await readFile(vsixPath);
	} catch {
		return {
			name: "VS Code extension",
			status: "would-skip",
			category: "ide",
			filePath,
		};
	}

	// The agent will install when the user confirms — report as would-create
	return {
		name: "VS Code extension",
		status: "would-create",
		category: "ide",
		filePath,
	};
}
