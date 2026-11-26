import listStaleFiles from "./listStaleFiles/index.js";
import detectStaleHooks from "./detectStaleHooks/index.js";

/**
 * Compute the `outdated` list aide_info reports: the stale artifact keys from
 * `.aide/versions.json` (manifest order), followed by the literal `"hooks"`
 * when the project's Claude Code hooks are missing or drifted.
 *
 * `hooks` is an upgrade category key, not a versions.json key — the hooks live
 * in `.claude/settings.json`, which the manifest does not track. It is checked
 * even when `.aide/versions.json` is missing, because a project without the
 * manifest is exactly the one most likely to lack the hooks. Never rejects:
 * the hooks check swallows its own failures.
 */
export default async function resolveOutdated(root: string): Promise<string[]> {
	const [staleFiles, staleHooks] = await Promise.all([listStaleFiles(root), detectStaleHooks(root)]);

	return staleHooks ? [...staleFiles, "hooks"] : staleFiles;
}
