import { access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep } from "@/types/index.js";
import brainContract from "@/service/brainContract/index.js";
import obsidianBrainAideTemplate from "../obsidianBrainAideTemplate/index.js";
import planBrainRepair from "./planBrainRepair/index.js";

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
 * Every returned step carries `brainContract`, the published required-section contract.
 *
 * - Absent file: `would-create` with the bundled template bytes as `content`. The template emits
 *   YAML null at every unwired slot in `mcpServerConfig.args`.
 * - Present file: `exists`, plus `brainRepair` only when the file is outdated (missing whole
 *   sections). `brainRepair` is an insertion-only prescription built from the latest bundled
 *   template; the agent applies it, this module never writes.
 *
 * The step `name` is load-bearing: the `/aide:brain config` prose locates the step by it.
 */
export default async function buildBrainAideStep(projectRoot: string): Promise<InitStep> {
	const filePath = join(projectRoot, ".aide", "config", "brain.aide");
	const name = "Brain config (brain.aide)";

	if (await exists(filePath)) {
		const brainRepair = await planBrainRepair(projectRoot);
		return {
			name,
			status: "exists",
			category: "brain",
			filePath,
			brainContract,
			...(brainRepair ? { brainRepair } : {}),
		};
	}

	return {
		name,
		status: "would-create",
		category: "brain",
		filePath,
		content: obsidianBrainAideTemplate(),
		brainContract,
	};
}
