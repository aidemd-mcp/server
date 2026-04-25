#!/usr/bin/env node
import { join, dirname } from "node:path";
import path from "node:path";
import writeMcpEntry from "./writeMcpEntry/index.js";
import renderWarning from "./renderWarning/index.js";
import type { InstallResult } from "./types/index.js";
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
 * surface inline:
 *
 * - Vault path (absent when `--vault-path` was supplied): open Claude Code and
 *   run `/aide` — the orchestrator's inline-recovery flow detects the missing
 *   path via `aide_info` and prompts for it.
 * - Brain vault scaffolding (absent when `--vault-path` was supplied): follows
 *   the vault path above via the same `/aide` run.
 * - IDE configuration (always present): re-run the CLI with `--ide <choice>`.
 *
 * When `--vault-path` IS provided, only IDE remains deferred.
 *
 * Single source of truth: passed as data to `renderWarning` so the renderer
 * remains reusable by any caller with a different deferred set.
 */
function deferredCategories(vaultPath: string | undefined): readonly string[] {
	if (vaultPath) {
		return [
			"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
		];
	}
	return [
		"Vault path — the obsidian MCP entry shell is written but the vault path is empty; open Claude Code and run /aide — the orchestrator will prompt for it",
		"Brain vault scaffolding (directories, playbook hub, vault CLAUDE.md) — follows the vault path above (same /aide run)",
		"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
	];
}

/**
 * Orchestrates the full cold-start install pipeline using planning-helper reuse:
 *
 * 1. **`writeMcpEntry` runs first** — it is the ONLY abort trigger. If `.mcp.json`
 *    is malformed, this function throws immediately with zero side effects (no other
 *    helper has run). The top-level IIFE's catch block converts the throw to a stderr
 *    error line and exits 1.
 *
 * 2. **`detectFramework`** resolves canonical Claude paths (`CLAUDE.md`,
 *    `.claude/commands`, `.claude/agents`, `.claude/skills`, `.aide/docs`, `.mcp.json`).
 *    The CLI is Claude-only; passing `"claude"` explicitly skips the detection walk.
 *
 * 3. **Planning helpers** (`writeMethodology`, `installMethodologyDocs`,
 *    `scaffoldCommands`, `installAgents`, `installSkills`, `installAideTree`,
 *    `scaffoldReadme`, plus an inline `versions.json` step) collect `InitStep[]`.
 *    These are planners — they never write to disk.
 *
 * 4. **Partition** by status: `toApply` (`would-create` only — enforces skip-on-exists),
 *    `skipped` (`would-overwrite` | `would-skip` — surfaces in the warning),
 *    `alreadyExists` (`exists` — logs `[exists]`, does NOT appear in the warning).
 *
 * 5. **`applySteps(toApply)`** writes only the `would-create` steps. The
 *    `would-create`-only filter is the mechanical invariant for "never overwrites".
 *
 * 6. **Per-file log** — one `[status] displayPath — message` line per artifact in
 *    original `plannedSteps` order, with the MCP result prepended.
 *
 * 7. **Warning block** — `renderWarning` receives every `skipped-drift` and
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
	options: { vaultPath?: string } = {},
): Promise<number> {
	// Step 1 — MCP entry first: the only helper that can throw (malformed JSON).
	// If it throws, propagate immediately — no other helpers run, guaranteeing
	// zero side effects on the abort path. Writes BOTH aide + obsidian entries;
	// the obsidian entry uses `vaultPath` when provided or an empty placeholder.
	const mcpRaw = await writeMcpEntry(cwd, options.vaultPath);
	const mcpResult: InstallResult = { ...mcpRaw, displayPath: ".mcp.json" };

	// Step 2 — Resolve framework config. Explicit "claude" skips the detection
	// walk and guarantees the canonical Claude paths without filesystem access.
	const config: FrameworkConfig = await detectFramework(cwd, "claude");

	// Step 3 — Collect planning steps from each helper. These planners never
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

	// Step 4 — Partition by status. The CLI may only write `would-create` steps
	// (skip-on-exists is the sole safe branch — there is no user to consent to
	// an overwrite). `would-overwrite` and `would-skip` steps are never applied;
	// they surface in the warning instead.
	const toApply = plannedSteps.filter((s) => s.status === "would-create");

	// Step 5 — Apply only the would-create steps. applySteps returns the same
	// steps with status flipped to "created" (for writes that succeeded).
	const applied = await applySteps(toApply);

	// Step 6 — Build the per-file log input. The MCP result is prepended;
	// every planned step follows in original order. Status is adapted from
	// InitStep status to InstallStatus.
	const results: InstallResult[] = [mcpResult];

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

	// Step 7 — Print the per-file log: one line per artifact in collected order.
	for (const r of results) write(`[${r.status}] ${r.displayPath} — ${r.message}`);

	// Step 8 — Aggregate the warning input. Only skipped-drift and
	// skipped-missing-canonical entries surface in the warning — `exists` means
	// bytes already match canonical, so no action is needed.
	const warningSkipped = results.filter(
		(r) => r.status === "skipped-drift" || r.status === "skipped-missing-canonical",
	);
	const warningFailed: InstallResult[] = [];

	// Step 9 — Render and write the warning block. Deferred categories depend on
	// whether the user supplied `--vault-path`: with a path, only IDE defers;
	// without, the vault path + brain scaffolding are also deferred.
	const warning = renderWarning({
		skipped: warningSkipped,
		failed: warningFailed,
		deferredCategories: deferredCategories(options.vaultPath),
	});

	if (warning) {
		for (const line of warning.split("\n")) write(line);
	} else {
		write("Already set up.");
	}

	// Step 10 — Always return 0. Non-zero exits happen only in the IIFE's catch.
	return 0;
}

/**
 * Parse `--vault-path=<path>` or `--vault-path <path>` from argv. Returns
 * the resolved path string or `undefined` if the flag is absent. Strings
 * are trimmed; an empty value after trimming is treated as absent.
 */
function parseVaultPath(argv: readonly string[]): string | undefined {
	const equalsForm = argv.find((a) => a.startsWith("--vault-path="));
	if (equalsForm) {
		const value = equalsForm.slice("--vault-path=".length).trim();
		return value.length > 0 ? value : undefined;
	}
	const idx = argv.indexOf("--vault-path");
	if (idx !== -1 && idx + 1 < argv.length) {
		const value = argv[idx + 1].trim();
		return value.length > 0 ? value : undefined;
	}
	return undefined;
}

(async () => {
	if (process.argv.includes("--help")) {
		process.stdout.write(
			"Usage: npx @aidemd-mcp/server init [--vault-path <path>]\n\n" +
				"Full cold-start installer for AIDE. Installs the complete non-interactive\n" +
				"footprint into the current project: methodology pointer stub, methodology doc\n" +
				"hub (.aide/docs/), all pipeline slash commands, all pipeline agent definitions,\n" +
				"all skill templates, aide + obsidian MCP server entries (additively merged into\n" +
				".mcp.json), and the aide-tree launcher. Never overwrites existing files —\n" +
				"skip-on-exists is the only safe branch.\n\n" +
				"Flags:\n" +
				"  --vault-path <path>   Set the obsidian MCP vault path at install time. When\n" +
				"                        omitted, the obsidian entry is written with an empty\n" +
				"                        path placeholder; open Claude Code and run /aide —\n" +
				"                        the orchestrator will prompt for it. `--vault-path=<path>` also works.\n\n" +
				"When --vault-path is not provided, the obsidian vault path and brain scaffolding\n" +
				"defer to /aide (the orchestrator's inline-recovery flow), and IDE configuration\n" +
				"defers to re-running this CLI with --ide <choice>. When --vault-path is provided,\n" +
				"only IDE configuration remains deferred. After the install pass, a terminal warning\n" +
				"lists anything skipped or deferred, with each entry naming its own follow-up surface.\n",
		);
		process.exit(0);
	}

	try {
		const vaultPath = parseVaultPath(process.argv.slice(2));
		const code = await runInit(process.cwd(), undefined, { vaultPath });
		process.exit(code);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(1);
	}
})();
