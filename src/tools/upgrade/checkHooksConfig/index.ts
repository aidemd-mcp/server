import type { FrameworkType, HooksFilePlan, HooksSettingsFile, UpgradeFileResult } from "@/types/index.js";
import planHooks from "@/service/install/shared/planHooks/index.js";

const RESULT_NAMES: Record<HooksSettingsFile, string> = {
	local: "Claude Code hooks (.claude/settings.local.json)",
	project: "AIDE hooks removed from shared settings (.claude/settings.json)",
	gitignore: ".gitignore entry for .claude/settings.local.json",
};

const SETTINGS_FILE_NAMES: Record<"local" | "project", string> = {
	local: ".claude/settings.local.json",
	project: ".claude/settings.json",
};

const TRACKED_TIP =
	"`.claude/settings.local.json` is tracked by git, so this machine's hook paths would be committed. Untracking it (`git rm --cached .claude/settings.local.json`) is the user's call; AIDE never runs it.";

/** Map one planned file to its upgrade result; `none` is only ever the local file, already current. */
function toResult(plan: HooksFilePlan): UpgradeFileResult {
	const base = { name: RESULT_NAMES[plan.file], filePath: plan.filePath, category: "hooks" as const };
	if (plan.change === "none") return { ...base, status: "matches", ...(plan.tracked ? { tip: TRACKED_TIP } : {}) };
	const status = plan.change === "create" ? "missing" : "differs";
	return { ...base, status, canonicalContent: plan.content, ...(plan.file === "local" && plan.tracked ? { tip: TRACKED_TIP } : {}) };
}

/**
 * Judge AIDE's Claude Code hooks by mapping the install service's `planHooks`
 * plan to upgrade results. Read-only — never writes. It holds no settings logic:
 * the bytes and the drift verdict come from the one planner install and boot share.
 *
 * Returns `[]` unless `framework` is `"claude"`: other frameworks have no hook
 * contract the `hook` command answers, and the planner is not called for them.
 * Otherwise `hooks`-category results, in this order:
 * - the local file `.claude/settings.local.json` — `"missing"` (no file yet),
 *   `"differs"` (an entry is missing, old, points at a location this machine lacks,
 *   or lacks the session-end timeout) or `"matches"`; carries `tip` when git tracks it;
 * - the shared `.claude/settings.json` — `"differs"`, only while it still holds an
 *   AIDE hook entry; its content is the file with just those entries removed;
 * - `.gitignore` — `"missing"` (no file) or `"differs"`, only when git does not
 *   already ignore the local file.
 * Every writable result carries `canonicalContent`.
 *
 * Two stop states return results that carry no content, so no apply writes anything:
 * without a global install, one `"missing"` local result with `globalPackage` and
 * install-first `instructions`; a settings file that cannot be parsed, one
 * `"malformed"` result per such file with `instructions` naming it and the reason.
 *
 * Detection reads both settings files, git and the global npm root. A category
 * apply re-plans from the files' current bytes.
 */
export default async function checkHooksConfig({
	projectRoot,
	framework,
}: {
	projectRoot: string;
	framework: FrameworkType;
}): Promise<UpgradeFileResult[]> {
	if (framework !== "claude") return [];

	const plan = await planHooks({ projectRoot });

	switch (plan.state) {
		case "no-global-install":
			return [
				{
					name: RESULT_NAMES.local,
					filePath: plan.filePath,
					status: "missing",
					category: "hooks",
					globalPackage: plan.globalPackage,
					instructions: `The aide server is not installed globally, so AIDE's hooks have nothing to run and none were planned. Run \`${plan.globalPackage.installCommand}\` via Bash, then apply the hooks category again. If the install fails, tell the user and write no hooks.`,
				},
			];
		case "malformed":
			return plan.files.map((file) => ({
				name: RESULT_NAMES[file.file],
				filePath: file.filePath,
				status: "malformed",
				category: "hooks",
				instructions: `\`${SETTINGS_FILE_NAMES[file.file]}\` cannot be parsed (${file.reason}), so nothing in the hooks category was written. Fix the file, then apply the hooks category again.`,
			}));
		case "planned":
			return plan.files.map(toResult);
	}
}
