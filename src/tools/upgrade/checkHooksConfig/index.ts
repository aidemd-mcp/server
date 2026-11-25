import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FrameworkType, UpgradeFileResult } from "@/types/index.js";
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
 * Compare AIDE's Claude Code hook entries against `<projectRoot>/.claude/settings.json`.
 * Read-only — never writes.
 *
 * Returns `[]` unless `framework` is `"claude"`: other frameworks have no hook
 * contract the `hook` command answers. Otherwise one `UpgradeFileResult` with
 * category `"hooks"`:
 * - `"missing"` — no settings file; `canonicalContent` is a new file holding only the hooks.
 * - `"differs"` — the file lacks some entries; `canonicalContent` is the byte-preserving
 *   merge (only AIDE's missing entries added).
 * - `"matches"` — every entry is already present.
 * - `"malformed"` — the file cannot be parsed; no content, so it is never written.
 *
 * The merge is planned from the file as it is on every call, so a category apply
 * merges from the file's current bytes.
 */
export default async function checkHooksConfig({
	projectRoot,
	framework,
}: {
	projectRoot: string;
	framework: FrameworkType;
}): Promise<UpgradeFileResult[]> {
	if (framework !== "claude") return [];

	const name = "Claude Code hooks";
	const filePath = join(projectRoot, ".claude", "settings.json");
	const plan = planHooksMerge({ text: await readOrNull(filePath) });

	switch (plan.state) {
		case "absent":
			return [{ name, filePath, status: "missing", category: "hooks", canonicalContent: plan.merged }];
		case "missing":
			return [{ name, filePath, status: "differs", category: "hooks", canonicalContent: plan.merged }];
		case "complete":
			return [{ name, filePath, status: "matches", category: "hooks" }];
		case "malformed":
			return [{ name, filePath, status: "malformed", category: "hooks" }];
	}
}
