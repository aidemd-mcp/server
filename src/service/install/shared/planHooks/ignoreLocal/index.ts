import { join } from "node:path";
import type { LocalIgnorePlan } from "@/types/index.js";
import readOptional from "../shared/readOptional/index.js";
import appendLine from "./appendLine/index.js";
import inspectGit from "./inspectGit/index.js";

const LOCAL_SETTINGS_PATH = ".claude/settings.local.json";

/**
 * Plans the `.gitignore` edit that keeps `.claude/settings.local.json` out of
 * git. `null` when the project is not in a git work tree (nothing to cover);
 * `edit: null` when git already ignores the file by any rule; otherwise the
 * whole new `.gitignore`, created or appended to. The line has no leading
 * slash: a pattern with an inner slash is already anchored to the .gitignore's
 * folder. `tracked` is reported so the caller can tell the user, never fixed
 * here. Reads only; never writes.
 */
export default async function ignoreLocal(input: { projectRoot: string }): Promise<LocalIgnorePlan | null> {
	const { projectRoot } = input;
	const status = await inspectGit({ projectRoot, path: LOCAL_SETTINGS_PATH });
	if (status === null) return null;
	if (status.ignored) return { tracked: status.tracked, edit: null };

	const text = await readOptional(join(projectRoot, ".gitignore"));
	return {
		tracked: status.tracked,
		edit: {
			change: text === null ? "create" : "update",
			content: appendLine({ text, line: LOCAL_SETTINGS_PATH }),
		},
	};
}
