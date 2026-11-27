import { join } from "node:path";
import type { HooksCategoryPlan, HooksFilePlan } from "@/types/index.js";
import aidePackage from "../aidePackage/index.js";
import ignoreLocal from "./ignoreLocal/index.js";
import locateEntry from "./locateEntry/index.js";
import mergeLocal from "./mergeLocal/index.js";
import readOptional from "./shared/readOptional/index.js";
import stripProject from "./stripProject/index.js";

/**
 * The one planner for the hooks category, shared by install, upgrade and boot.
 *
 * Decides every byte the category writes: AIDE's hook entries in the per-machine
 * `.claude/settings.local.json` (a direct `node "<entry>" hook` call on this
 * machine's global install), the removal of AIDE's old entries from the shared
 * `.claude/settings.json`, and the `.gitignore` line that keeps the local file out
 * of git. Reads only; never writes. Consumers map the result: `installHooks` to
 * init steps, upgrade's `checkHooksConfig` to upgrade results.
 *
 * Without a global install nothing is planned and nothing is read. A settings file
 * that cannot be parsed stops the whole category, since any write could leave AIDE
 * registered in both files. Planning the result of an applied plan yields only the
 * local file as `none`.
 */
export default async function planHooks({ projectRoot }: { projectRoot: string }): Promise<HooksCategoryPlan> {
	const localPath = join(projectRoot, ".claude", "settings.local.json");
	const projectPath = join(projectRoot, ".claude", "settings.json");

	// 1. Without this machine's installed entry point there is nothing for a hook to run.
	const entry = await locateEntry();
	if (entry === null) {
		return {
			state: "no-global-install",
			filePath: localPath,
			globalPackage: { name: aidePackage.name, installed: false, installCommand: aidePackage.installCommand },
		};
	}

	// 2. Both settings files as they are on disk (null when absent).
	const [localText, projectText] = await Promise.all([readOptional(localPath), readOptional(projectPath)]);

	// 3. What each file needs: AIDE's entries merged into local, AIDE's old entries stripped from project.
	const local = mergeLocal({ text: localText, entry });
	const project = stripProject({ text: projectText });

	// 4. A malformed file stops the category; every malformed file is named, local first.
	const malformed: Extract<HooksCategoryPlan, { state: "malformed" }>["files"] = [];
	if (local.state === "malformed") malformed.push({ file: "local", filePath: localPath, reason: local.reason });
	if (project.state === "malformed") malformed.push({ file: "project", filePath: projectPath, reason: project.reason });
	if (malformed.length > 0) return { state: "malformed", files: malformed };

	// 5. The .gitignore edit, when git does not already cover the local file.
	const ignore = await ignoreLocal({ projectRoot });

	// 6. The local file always, then the project file and the .gitignore only when they change.
	const files: HooksFilePlan[] = [];
	const tracked = ignore?.tracked ?? false;
	if (local.state === "absent") files.push({ file: "local", filePath: localPath, change: "create", content: local.merged, tracked });
	else if (local.state === "outdated") files.push({ file: "local", filePath: localPath, change: "update", content: local.merged, tracked });
	else files.push({ file: "local", filePath: localPath, change: "none", tracked });

	if (project.state === "holds") files.push({ file: "project", filePath: projectPath, change: "update", content: project.stripped });
	if (ignore?.edit) {
		files.push({ file: "gitignore", filePath: join(projectRoot, ".gitignore"), change: ignore.edit.change, content: ignore.edit.content });
	}
	return { state: "planned", files };
}
