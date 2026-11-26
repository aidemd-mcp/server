import detectFramework from "@/service/install/detectFramework/index.js";
import checkHooksConfig from "@/tools/upgrade/checkHooksConfig/index.js";

/**
 * Reports whether the project's Claude Code hooks need applying, so boot can
 * point the user at the upgrade. Boot must agree with `aide_upgrade` on what
 * counts as stale, so the judgement is the upgrade's own: the same framework
 * auto-detection (no override, as when the upgrade runs without a framework)
 * and the same `checkHooksConfig`. Any result that is not `matches` (`missing`,
 * `differs`, `malformed`) is stale; a framework with no hooks yields no results
 * and is never flagged.
 *
 * Never rejects: boot is read-only reporting and a check that cannot be made
 * must stay silent rather than break it, so any failure resolves to false.
 */
export default async function detectStaleHooks(root: string): Promise<boolean> {
	try {
		const config = await detectFramework(root);
		const results = await checkHooksConfig({ projectRoot: root, framework: config.framework });
		return results.some((result) => result.status !== "matches");
	} catch {
		return false;
	}
}
