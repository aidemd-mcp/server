import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FrameworkType, InitStep } from "@/types/index.js";
import planHooksMerge from "@/service/install/shared/planHooksMerge/index.js";

/** Read a file, returning null when it does not exist. */
async function readOrNull(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf-8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

/**
 * Plan AIDE's Claude Code hook entries in `<projectRoot>/.claude/settings.json`.
 *
 * Returns `[]` unless `framework` is `"claude"`: other frameworks have no hook
 * contract the `hook` command answers. Otherwise one `hooks`-category step:
 * - `would-create` — no settings file; `content` is a new file holding only the hooks.
 * - `would-overwrite` — the file lacks some entries; `content` is the byte-preserving
 *   merge (only AIDE's missing entries added), so the consumer asks before writing.
 * - `exists` — every entry is already present.
 * - `would-skip` with `configMalformed` — the file cannot be parsed; it is left alone.
 *
 * This function never writes to disk — `applySteps` writes on the consumer's call.
 */
export default async function installHooks({
	projectRoot,
	framework,
}: {
	projectRoot: string;
	framework: FrameworkType;
}): Promise<InitStep[]> {
	if (framework !== "claude") return [];

	const filePath = join(projectRoot, ".claude", "settings.json");
	const name = "Claude Code hooks (.claude/settings.json)";
	const plan = planHooksMerge({ text: await readOrNull(filePath) });

	switch (plan.state) {
		case "absent":
			return [{ name, status: "would-create", category: "hooks", filePath, content: plan.merged }];
		case "missing":
			return [{ name, status: "would-overwrite", category: "hooks", filePath, content: plan.merged }];
		case "complete":
			return [{ name, status: "exists", category: "hooks", filePath }];
		case "malformed":
			return [{ name, status: "would-skip", category: "hooks", filePath, configMalformed: true }];
	}
}
