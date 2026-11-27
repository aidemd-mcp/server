import type { FrameworkType, HooksFilePlan, HooksSettingsFile, InitStep } from "@/types/index.js";
import planHooks from "@/service/install/shared/planHooks/index.js";

const STEP_NAMES: Record<HooksSettingsFile, string> = {
	local: "Claude Code hooks (.claude/settings.local.json)",
	project: "AIDE hooks removed from shared settings (.claude/settings.json)",
	gitignore: ".gitignore entry for .claude/settings.local.json",
};

const SETTINGS_FILE_NAMES: Record<"local" | "project", string> = {
	local: ".claude/settings.local.json",
	project: ".claude/settings.json",
};

/** Map one planned file to its write step; the local file alone can be `exists` (no change). */
function toStep(plan: HooksFilePlan): InitStep {
	const name = STEP_NAMES[plan.file];
	const base = { name, category: "hooks" as const, filePath: plan.filePath };
	if (plan.change === "none") return { ...base, status: "exists" };
	if (plan.change === "create") return { ...base, status: "would-create", content: plan.content };
	return { ...base, status: "would-overwrite", content: plan.content };
}

/**
 * Plan AIDE's Claude Code hooks by mapping `planHooks`' category plan to init steps.
 *
 * Returns `[]` unless `framework` is `"claude"`: other frameworks have no hook
 * contract the `hook` command answers, and neither npm nor git is probed for them.
 * Otherwise `hooks`-category steps, in this order:
 * - the local file `.claude/settings.local.json` — `would-create`, `would-overwrite`
 *   (AIDE's entries added or rewritten to this machine's direct node call) or `exists`;
 * - the shared `.claude/settings.json` — `would-overwrite`, only when it still holds
 *   AIDE's old entries; `content` is the file with just those removed;
 * - `.gitignore` — `would-create` or `would-overwrite`, only when git does not already
 *   ignore the local file.
 *
 * Two stop states plan nothing else: without a global install, one `would-skip` step
 * carries `globalPackage` and install-first `instructions`; a settings file that cannot
 * be parsed yields one `would-skip` step per such file with `configMalformed`.
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

	const plan = await planHooks({ projectRoot });

	switch (plan.state) {
		case "no-global-install":
			return [
				{
					name: STEP_NAMES.local,
					status: "would-skip",
					category: "hooks",
					filePath: plan.filePath,
					globalPackage: plan.globalPackage,
					instructions: `The aide server is not installed globally, so AIDE's hooks have nothing to run and none were planned. Run \`${plan.globalPackage.installCommand}\` via Bash, then apply the hooks category again. If the install fails, tell the user and write no hooks.`,
				},
			];
		case "malformed":
			return plan.files.map((file) => ({
				name: STEP_NAMES[file.file],
				status: "would-skip",
				category: "hooks",
				filePath: file.filePath,
				configMalformed: true,
				instructions: `\`${SETTINGS_FILE_NAMES[file.file]}\` cannot be parsed (${file.reason}), so nothing in the hooks category was written. Fix the file, then apply the hooks category again.`,
			}));
		case "planned":
			return plan.files.map(toStep);
	}
}
