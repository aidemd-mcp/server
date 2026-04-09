import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InitStepResult } from "../../types/index.js";

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
 * Configure Zed to treat .aide files as Markdown.
 * Patches `.zed/settings.json` in the project root, merging the
 * `file_types.Markdown` array. Preserves all other settings.
 */
export async function configureZed(projectRoot: string): Promise<InitStepResult> {
	const settingsPath = join(projectRoot, ".zed", "settings.json");
	const existing = await safeReadFile(settingsPath);

	if (existing) {
		try {
			const settings = JSON.parse(existing);
			const fileTypes = settings.file_types || {};
			const mdTypes: string[] = fileTypes.Markdown || [];

			if (mdTypes.includes("*.aide")) {
				return { name: "Zed config", status: "exists" };
			}

			mdTypes.push("*.aide");
			fileTypes.Markdown = mdTypes;
			settings.file_types = fileTypes;

			await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
			return { name: "Zed config", status: "created" };
		} catch {
			return { name: "Zed config", status: "skipped" };
		}
	}

	const settings = { file_types: { Markdown: ["*.aide"] } };
	await mkdir(join(projectRoot, ".zed"), { recursive: true });
	await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
	return { name: "Zed config", status: "created" };
}

/**
 * Install the AIDE VS Code extension if `code` CLI is available.
 * The `.vsix` is resolved relative to this package's `extensions/vscode/` dir.
 */
export async function configureVscode(extensionsDir: string): Promise<InitStepResult> {
	// Check if `code` CLI is on PATH
	try {
		await execFileAsync("code", ["--version"]);
	} catch {
		return { name: "VS Code extension", status: "skipped" };
	}

	// Check if already installed
	try {
		const { stdout } = await execFileAsync("code", ["--list-extensions"]);
		if (stdout.toLowerCase().includes("aide-markdown")) {
			return { name: "VS Code extension", status: "exists" };
		}
	} catch {
		return { name: "VS Code extension", status: "skipped" };
	}

	// Find and install .vsix
	const vsixPath = resolve(extensionsDir, "aide-markdown-0.0.1.vsix");
	try {
		await readFile(vsixPath);
	} catch {
		// .vsix not built yet — try to find the package.json at least
		const pkgPath = resolve(extensionsDir, "package.json");
		try {
			await readFile(pkgPath);
			return { name: "VS Code extension", status: "skipped" };
		} catch {
			return { name: "VS Code extension", status: "skipped" };
		}
	}

	try {
		await execFileAsync("code", ["--install-extension", vsixPath]);
		return { name: "VS Code extension", status: "installed" };
	} catch {
		return { name: "VS Code extension", status: "skipped" };
	}
}
