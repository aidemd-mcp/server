#!/usr/bin/env node
import { join, dirname } from "node:path";
import { writeFile, access, mkdir } from "node:fs/promises";
import path from "node:path";
import writeMcpEntry from "./writeMcpEntry/index.js";
import renderWarning from "./renderWarning/index.js";
import type { InstallResult } from "./types/index.js";
import obsidianBrainAideTemplate from "@/service/install/provisionBrain/obsidianBrainAideTemplate/index.js";
import writeMethodology from "@/service/install/writeMethodology/index.js";
import installMethodologyDocs from "@/service/install/installMethodologyDocs/index.js";
import scaffoldCommands from "@/service/install/scaffoldCommands/index.js";
import installAgents from "@/service/install/installAgents/index.js";
import installSkills from "@/service/install/installSkills/index.js";
import installAideTree from "@/service/install/installAideTree/index.js";
import scaffoldReadme from "@/service/install/scaffoldReadme/index.js";
import applySteps from "@/service/install/applySteps/index.js";
import detectFramework from "@/service/install/detectFramework/index.js";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";
import type { InitStep, FrameworkConfig } from "@/types/index.js";

/**
 * Returns the list of deferred-category descriptions to pass to `renderWarning`.
 * Each string is self-contained guidance that names the per-category follow-up
 * surface inline.
 *
 * Brain wiring is no longer a "category absent because the flag wasn't supplied."
 * It is a category that FINISHED scaffolding but still has a `<BRAIN_PATH>`
 * placeholder in `mcpServerConfig.args`, routed exclusively to `/aide:brain config`.
 * The brain item MUST NEVER name `/aide` or any orchestrator inline-recovery
 * surface — doing so violates the spec's undesired outcome: "directs the user to
 * a removed slash command." Only `/aide:brain config` is the correct follow-up.
 *
 * - Brain wiring (when `--brain-path` is omitted): `.aide/config/brain.aide` was
 *   scaffolded with a `<BRAIN_PATH>` placeholder in `mcpServerConfig.args`. The
 *   brain MCP server will not launch successfully until the placeholder is replaced.
 *   Open Claude Code and run `/aide:brain config <absolute-path-to-your-brain>`.
 * - IDE configuration (always present): re-run the CLI with `--ide <choice>`.
 *
 * When `--brain-path` IS provided, the brain entry in `.mcp.json` carries the real
 * path so only IDE remains deferred.
 *
 * Single source of truth: passed as data to `renderWarning` so the renderer
 * remains reusable by any caller with a different deferred set.
 */
function deferredCategories(brainPath: string | undefined): readonly string[] {
	if (brainPath) {
		return [
			"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
		];
	}
	return [
		"Brain wiring — .aide/config/brain.aide was scaffolded with a <BRAIN_PATH> placeholder in mcpServerConfig.args. The brain MCP server will not launch successfully until the placeholder is replaced. Open Claude Code and run /aide:brain config <absolute-path-to-your-brain>.",
		"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
	];
}

/**
 * Orchestrates the full cold-start install pipeline using planning-helper reuse:
 *
 * 1. **Brain.aide scaffold** — `.aide/config/brain.aide` does not yet exist, writes
 *    the canonical Obsidian template to disk. Seed-semantic: never overwrites. Logs
 *    `[created]` or `[exists]`. This step runs BEFORE `writeMcpEntry` because
 *    `writeMcpEntry` reads brain.aide from disk to derive the brain MCP entry.
 *    When `--brain-path` is absent, the template lands the literal `<BRAIN_PATH>`
 *    placeholder in `mcpServerConfig.args`.
 *
 * 2. **`writeMcpEntry` runs second** — it is the ONLY abort trigger. If `.mcp.json`
 *    is malformed, this function throws immediately (only the brain.aide scaffold
 *    may have run). The top-level IIFE's catch block converts the throw to a stderr
 *    error line and exits 1.
 *
 * 3. **`detectFramework`** resolves canonical Claude paths (`CLAUDE.md`,
 *    `.claude/commands`, `.claude/agents`, `.claude/skills`, `.aide/docs`, `.mcp.json`).
 *    The CLI is Claude-only; passing `"claude"` explicitly skips the detection walk.
 *
 * 4. **Planning helpers** (`writeMethodology`, `installMethodologyDocs`,
 *    `scaffoldCommands`, `installAgents`, `installSkills`, `installAideTree`,
 *    `scaffoldReadme`, plus an inline `versions.json` step) collect `InitStep[]`.
 *    These are planners — they never write to disk.
 *
 * 5. **Partition** by status: `toApply` (`would-create` only — enforces skip-on-exists),
 *    `skipped` (`would-overwrite` | `would-skip` — surfaces in the warning),
 *    `alreadyExists` (`exists` — logs `[exists]`, does NOT appear in the warning).
 *
 * 6. **`applySteps(toApply)`** writes only the `would-create` steps. The
 *    `would-create`-only filter is the mechanical invariant for "never overwrites".
 *
 * 7. **Per-file log** — one `[status] displayPath — message` line per artifact in
 *    original `plannedSteps` order, with the brain.aide and MCP results prepended.
 *
 * 8. **Warning block** — `renderWarning` receives every `skipped-drift` and
 *    `skipped-missing-canonical` result as `skipped`, an empty `failed` array, and
 *    always `DEFERRED_CATEGORIES`. Non-empty → print the block. Empty → print the
 *    plain completion line.
 *
 * **Exit-code contract:** returns `0` unconditionally. The only non-zero exit path
 * is the top-level IIFE's `catch` block.
 *
 * @param cwd - Project root to install artifacts into.
 * @param write - Line-writer injected for testability; defaults to stdout.
 */
export async function runInit(
	cwd: string,
	write: (line: string) => void = (line) => process.stdout.write(line + "\n"),
	options: { brainPath?: string } = {},
): Promise<number> {
	// Step 1 — Brain.aide scaffold: seed-semantic write that must happen BEFORE
	// writeMcpEntry because writeMcpEntry reads brain.aide from disk to derive the
	// brain MCP entry. Runs unconditionally — without a brainPath the template lands
	// the <BRAIN_PATH> placeholder; the category is deferred to /aide:brain config.
	//
	// Files inside `.aide/config/` are user-owned per the root spec — this scaffold
	// runs once on first cold start where the file is absent and never touches the
	// file again on any subsequent run, regardless of byte drift from the canonical
	// default.
	const brainAidePath = join(cwd, ".aide", "config", "brain.aide");
	let brainAideExists = false;
	try {
		await access(brainAidePath);
		brainAideExists = true;
	} catch {
		// ENOENT — file does not exist, proceed to create.
	}

	const brainAideResult: InstallResult = brainAideExists
		? {
				status: "exists",
				displayPath: ".aide/config/brain.aide",
				message: "already present",
			}
		: await (async () => {
				const content = obsidianBrainAideTemplate(options.brainPath);
				await mkdir(dirname(brainAidePath), { recursive: true });
				await writeFile(brainAidePath, content, "utf-8");
				return {
					status: "created" as const,
					displayPath: ".aide/config/brain.aide",
					message: options.brainPath
						? "Brain config (Obsidian default)"
						: "Brain config (Obsidian default, <BRAIN_PATH> placeholder)",
				};
			})();

	// Step 2 — MCP entry: the only helper that can throw (malformed JSON). Runs
	// AFTER the brain.aide scaffold so brain.aide is on disk when brainPath is
	// supplied — writeMcpEntry reads it to derive the brain entry. If it throws,
	// propagate immediately; the IIFE catch block converts the throw to a stderr
	// error line and exits 1.
	const mcpRaw = await writeMcpEntry(cwd, options.brainPath);
	const mcpResult: InstallResult = { ...mcpRaw, displayPath: ".mcp.json" };

	// Step 3 — Resolve framework config. Explicit "claude" skips the detection
	// walk and guarantees the canonical Claude paths without filesystem access.
	const config: FrameworkConfig = await detectFramework(cwd, "claude");

	// Step 4 — Collect planning steps from each helper. These planners never
	// write to disk; they inspect disk state and return InitStep[] with
	// would-create / would-overwrite / would-skip / exists status.
	const methodologyStep = await writeMethodology(join(cwd, config.configPath), config.docHubDir);
	const docSteps = await installMethodologyDocs(join(cwd, config.docHubDir), config.docHubDir);
	const commandSteps = await scaffoldCommands(join(cwd, config.commandDir));
	const agentSteps = await installAgents(join(cwd, config.agentDir));
	const skillSteps = await installSkills(join(cwd, config.skillDir));
	const aideTreeSteps = await installAideTree(cwd);
	const readmeStep = await scaffoldReadme(cwd);

	// Inline versions.json step — mirrors how src/tools/init/index.ts builds
	// `versionsStep`: compute the host path, read the manifest, stringify it,
	// compare bytes, and map "would-skip" → "exists" (bytes already match).
	const versionsHostPath = join(cwd, dirname(config.docHubDir), "versions.json");
	const versionsManifest = readVersionsManifest();
	const versionsJson = JSON.stringify(versionsManifest, null, 2) + "\n";
	const versionsBytesResult = await compareBytes(versionsHostPath, versionsJson);
	const versionsStep: InitStep = {
		name: "versions.json",
		status: versionsBytesResult === "would-skip" ? "exists" : versionsBytesResult,
		category: "methodology",
		filePath: versionsHostPath,
		...(versionsBytesResult !== "would-skip" ? { content: versionsJson } : {}),
	};

	// Flatten all planning steps into a single ordered list. Order mirrors the
	// MCP tool's orchestrator: methodology pointer, docs, versions, commands,
	// agents, skills, aide-tree, readme.
	const plannedSteps: InitStep[] = [
		methodologyStep,
		...docSteps,
		versionsStep,
		...commandSteps,
		...agentSteps,
		...skillSteps,
		...aideTreeSteps,
		readmeStep,
	];

	// Step 5 — Partition by status. The CLI may only write `would-create` steps
	// (skip-on-exists is the sole safe branch — there is no user to consent to
	// an overwrite). `would-overwrite` and `would-skip` steps are never applied;
	// they surface in the warning instead.
	const toApply = plannedSteps.filter((s) => s.status === "would-create");

	// Step 6 — Apply only the would-create steps. applySteps returns the same
	// steps with status flipped to "created" (for writes that succeeded).
	const applied = await applySteps(toApply);

	// Step 6 (now 7) — Build the per-file log input. Brain.aide result is first
	// (always present — scaffold is unconditional), MCP result is second, then
	// every planned step in original order. Status is adapted from InitStep status
	// to InstallStatus.
	const results: InstallResult[] = [brainAideResult, mcpResult];

	for (const step of plannedSteps) {
		const displayPath = path.relative(cwd, step.filePath).split(path.sep).join("/");

		if (step.status === "would-create") {
			// This branch is only reached for would-create steps sent to applySteps;
			// report them as created.
			const postStatus = "created";
			results.push({ status: postStatus, displayPath, message: step.name });
			continue;
		}

		if (step.status === "exists") {
			results.push({ status: "exists", displayPath, message: "already present" });
			continue;
		}

		if (step.status === "would-overwrite") {
			results.push({
				status: "skipped-drift",
				displayPath,
				message: "drifted from canonical — not overwritten",
			});
			continue;
		}

		if (step.status === "would-skip") {
			results.push({
				status: "skipped-missing-canonical",
				displayPath,
				message: "canonical content unavailable",
			});
			continue;
		}

		// "overwritten" must not appear on the CLI path — the filter above ensures
		// only would-create steps reach applySteps. If observed, it means the
		// partition in step 4 broke.
		throw new Error(
			`Unexpected step status "${step.status}" for ${step.filePath} — the would-create filter is broken.`,
		);
	}

	// Step 8 — Print the per-file log: one line per artifact in collected order.
	for (const r of results) write(`[${r.status}] ${r.displayPath} — ${r.message}`);

	// Step 9 — Aggregate the warning input. Only skipped-drift and
	// skipped-missing-canonical entries surface in the warning — `exists` means
	// bytes already match canonical, so no action is needed.
	const warningSkipped = results.filter(
		(r) => r.status === "skipped-drift" || r.status === "skipped-missing-canonical",
	);
	const warningFailed: InstallResult[] = [];

	// Step 10 — Render and write the warning block. Deferred categories depend on
	// whether the user supplied `--brain-path`: with a path, only IDE defers;
	// without, the brain placeholder item routes to /aide:brain config.
	const warning = renderWarning({
		skipped: warningSkipped,
		failed: warningFailed,
		deferredCategories: deferredCategories(options.brainPath),
	});

	if (warning) {
		for (const line of warning.split("\n")) write(line);
	} else {
		write("Already set up.");
	}

	// Step 11 — Always return 0. Non-zero exits happen only in the IIFE's catch.
	return 0;
}

/**
 * Parse `--brain-path=<path>` or `--brain-path <path>` from argv. Returns
 * the resolved path string or `undefined` if the flag is absent. Strings
 * are trimmed; an empty value after trimming is treated as absent.
 */
function parseBrainPath(argv: readonly string[]): string | undefined {
	const equalsForm = argv.find((a) => a.startsWith("--brain-path="));
	if (equalsForm) {
		const value = equalsForm.slice("--brain-path=".length).trim();
		return value.length > 0 ? value : undefined;
	}
	const idx = argv.indexOf("--brain-path");
	if (idx !== -1 && idx + 1 < argv.length) {
		const value = argv[idx + 1].trim();
		return value.length > 0 ? value : undefined;
	}
	return undefined;
}

(async () => {
	if (process.argv.includes("--help")) {
		process.stdout.write(
			"Usage: npx @aidemd-mcp/server init [--brain-path <path>]\n\n" +
				"Full cold-start installer for AIDE. Installs the complete non-interactive\n" +
				"footprint into the current project: methodology pointer stub, methodology doc\n" +
				"directory (.aide/docs/), all pipeline slash commands, all pipeline agent definitions,\n" +
				"all skill templates, .aide/config/brain.aide (always scaffolded), aide and brain\n" +
				"MCP server entries (additively merged into .mcp.json), and the aide-tree launcher.\n" +
				"Never overwrites existing files — skip-on-exists is the only safe branch.\n\n" +
				"Flags:\n" +
				"  --brain-path <path>   Set the brain root path at install time. When supplied,\n" +
				"                        the CLI inlines the path byte-for-byte as the last entry\n" +
				"                        of mcpServerConfig.args in .aide/config/brain.aide, and\n" +
				"                        derives the brain MCP entry from it. When omitted, the\n" +
				"                        scaffold still lands but with a <BRAIN_PATH> placeholder\n" +
				"                        in mcpServerConfig.args; replace it later with:\n" +
				"                        /aide:brain config <absolute-path-to-your-brain>.\n" +
				"                        `--brain-path=<path>` also works.\n\n" +
				"Post-install brain edits (retargeting the brain root path inline in mcpServerConfig.args,\n" +
				"swapping the launcher command, renaming the brain via the name field) propagate\n" +
				"to .mcp.json via: npx aidemd-mcp sync\n\n" +
				"When --brain-path is not provided, .aide/config/brain.aide is scaffolded with a\n" +
				"<BRAIN_PATH> placeholder in mcpServerConfig.args. The brain MCP server will not\n" +
				"launch successfully until the placeholder is replaced via:\n" +
				"  /aide:brain config <absolute-path-to-your-brain>\n" +
				"IDE configuration always defers to re-running this CLI with --ide <choice>.\n" +
				"After the install pass, a terminal warning lists anything skipped or deferred,\n" +
				"with each entry naming its own follow-up surface.\n",
		);
		process.exit(0);
	}

	try {
		const brainPath = parseBrainPath(process.argv.slice(2));
		const code = await runInit(process.cwd(), undefined, { brainPath });
		process.exit(code);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(1);
	}
})();
