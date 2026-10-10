import { access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep, LaunchMode } from "@/types/index.js";
import parseBrainAide from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import summarizeBrainConfig from "./summarizeBrainConfig/index.js";

/** Check if a path exists. */
async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Build the brain.aide config file planning step.
 *
 * Presence-only (seed-semantic) idempotency: if the file exists at `.aide/config/brain.aide`
 * within the host project root, the step is `exists`. The file lives under `.aide/config/`,
 * the host's user-owned configuration directory. The step never returns `would-overwrite` and
 * never carries `content` for an existing file; the directory boundary is the ownership signal.
 *
 * Every returned step carries `brainSummary`, a content-free summary (section list with seed
 * paths and sizes, missing and stale section markers, legacy launcher reasons, whether the
 * launcher is the bundled template's integration). It carries no section text, contract,
 * repair prescription or migration body, on any status; aide_upgrade's brain category applies
 * insertion and migration, never this step.
 *
 * - Absent file: `would-create` with the bundled template bytes as `content` (the only status
 *   that carries it: the install summary strips it, applySteps writes it) and an empty-findings
 *   summary. The template emits YAML null at every unwired slot in `mcpServerConfig.args`.
 * - Present file: `exists`, no `content`, and a summary of the parse of the file as it stands.
 *
 * The step `name` is load-bearing: the `/aide:brain config` prose locates the step by it.
 *
 * @param projectRoot - Host project root (where `.aide/config/brain.aide` lives).
 * @param brainMode - Optional launch mode for the would-create template launcher; omitted means local.
 */
export default async function buildBrainAideStep(
	projectRoot: string,
	brainMode?: LaunchMode,
): Promise<InitStep> {
	const filePath = join(projectRoot, ".aide", "config", "brain.aide");
	const name = "Brain config (brain.aide)";

	if (await exists(filePath)) {
		const parse = await parseBrainAide(projectRoot);
		return {
			name,
			status: "exists",
			category: "brain",
			filePath,
			brainSummary: summarizeBrainConfig(parse),
		};
	}

	return {
		name,
		status: "would-create",
		category: "brain",
		filePath,
		content: obsidianBrainAideTemplate(brainMode),
		brainSummary: summarizeBrainConfig(null),
	};
}
