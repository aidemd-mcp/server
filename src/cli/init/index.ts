#!/usr/bin/env node
import { join } from "node:path";
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
import { planBrainCategory } from "@/service/install/index.js";
import detectFramework from "@/service/install/detectFramework/index.js";
import readVersionsManifest from "@/tools/upgrade/buildVersionsMeta/index.js";
import compareBytes from "@/service/install/shared/compareBytes/index.js";
import type { InitStep, FrameworkConfig } from "@/types/index.js";

/**
 * Registered brain integrations. Today only "obsidian" is valid. Future
 * integrations land their own bundled templates and add their name here.
 *
 * This registry lives at the cli/init argument boundary — validation happens
 * here, before the install service is called. The install service and
 * provisionBrain do not validate integration names; that is cli/init's job.
 */
const BRAIN_INTEGRATIONS = ["obsidian"] as const;

/**
 * Flags whose presence at install time is forbidden. Every flag in this set
 * accepts a backend-specific datum (path, token, URI, vault root) and is
 * replaced by `/aide:brain config` inside an agent session.
 */
const FORBIDDEN_BRAIN_FLAGS = [
	"--brain-path",
	"--vault-path",
	"--brain-root",
	"--brain-token",
	"--brain-url",
	"--brain-name",
] as const;

/**
 * Returns the list of deferred-category descriptions to pass to `renderWarning`.
 * Each string is self-contained guidance that names the per-category follow-up
 * surface inline.
 *
 * Brain wiring is always deferred — cli/init scaffolds the bundled `brain.aide`
 * template with YAML null at the unwired slot but never fills it, never derives
 * the brain MCP entry, and never seeds the four entry-point artifacts. Those steps
 * belong exclusively to `/aide:brain config` on the first `/aide` run.
 *
 * The brain entry MUST name `/aide:brain config` as the wiring surface and MUST
 * NOT name `/aide` as the wiring surface. Naming `/aide` for brain wiring violates
 * the spec's undesired outcome "directs the user to a removed slash command" —
 * `/aide` routes to `/aide:brain config`; it does not own brain-wiring inline
 * recovery.
 *
 * IDE configuration always defers — cli/init never guesses, defaults, or scans
 * the filesystem for IDE choice. Re-run with `--ide <choice>` to resolve.
 */
function deferredCategories(): readonly string[] {
	return [
		"Brain wiring — open Claude Code and run /aide; on the first run, /aide:brain config will fill the unwired slot in .aide/config/brain.aide, derive the brain MCP entry through cli/sync, and seed the four entry-point artifacts into your brain.",
		"IDE configuration — re-run: npx aidemd-mcp init --ide <choice>",
	];
}

/**
 * Orchestrates the full cold-start install pipeline:
 *
 * 1. **Brain.aide scaffold** — delegates to the install service's
 *    `planBrainCategory` to obtain the two InitStep records returned by
 *    `provisionBrain`. Applies ONLY the brain.aide-scaffold InitStep via
 *    `applySteps`; the MCP-entry-plan InitStep is deliberately discarded.
 *    cli/init never touches `.aide/config/` directly. The applied step's
 *    status becomes the first element of the per-file log.
 *
 *    `options.brain` selects which bundled template scaffolds (default
 *    `"obsidian"`). No `brainPath` field exists on `options` under any rename.
 *
 * 2. **`writeMcpEntry` runs second** — it is the ONLY abort trigger. If
 *    `.mcp.json` is malformed, this function throws immediately. The top-level
 *    IIFE's catch block converts the throw to a stderr error line and exits 1.
 *
 * 3. **`detectFramework`** resolves canonical Claude paths. The CLI is
 *    Claude-only; passing `"claude"` skips the detection walk.
 *
 * 4. **Planning helpers** collect `InitStep[]`. These planners never write
 *    to disk.
 *
 * 5. **Partition** by status: `toApply` (`would-create` only — enforces
 *    skip-on-exists), `skipped` (`would-overwrite` | `would-skip`).
 *
 * 6. **`applySteps(toApply)`** writes only the `would-create` steps.
 *
 * 7. **Per-file log** — one `[status] displayPath — message` line per
 *    artifact in original order, with the brain.aide result prepended.
 *
 * 8. **Warning block** — `renderWarning` receives every `skipped-drift` and
 *    `skipped-missing-canonical` result, an empty `failed` array, and the
 *    two-item `deferredCategories()` array.
 *
 * **Exit-code contract:** returns `0` unconditionally. The only non-zero exit
 * path is the top-level IIFE's `catch` block.
 *
 * @param cwd - Project root to install artifacts into.
 * @param write - Line-writer injected for testability; defaults to stdout.
 * @param options - Optional. `brain` selects the bundled template (default
 *   `"obsidian"`). No `brainPath` parameter exists on this object under any
 *   rename — the install service accepts only the integration name, not a
 *   backend-specific datum.
 */
export async function runInit(
	cwd: string,
	write: (line: string) => void = (line) => process.stdout.write(line + "\n"),
	options: { brain?: string } = {},
): Promise<number> {
	const integration = options.brain ?? "obsidian";

	// Step 1 — Brain.aide scaffold: delegate to the install service. Obtain both
	// steps provisionBrain returns, apply only the brain.aide-scaffold step (first
	// in fixed order), and discard the MCP-entry-plan step. The MCP entry is owned
	// by cli/sync invoked from /aide:brain config after the user has filled the null
	// slot(s) — applying it here would land a null-bearing brain entry that sync
	// refuses at its boundary.
	const brainSteps = await planBrainCategory(cwd, integration);
	const brainAideStep = brainSteps.find((s) => s.category === "brain" && s.name === "Brain config (brain.aide)");
	const brainScaffoldResult: InstallResult = await (async () => {
		if (!brainAideStep) {
			// Defensive: planBrainCategory always returns this step; this branch should
			// never fire in practice. Report as exists so the log isn't confusing.
			return { status: "exists" as const, displayPath: ".aide/config/brain.aide", message: "already present" };
		}
		if (brainAideStep.status === "exists") {
			return { status: "exists" as const, displayPath: ".aide/config/brain.aide", message: "already present" };
		}
		// would-create — apply this single step to disk.
		await applySteps([brainAideStep]);
		return {
			status: "created" as const,
			displayPath: ".aide/config/brain.aide",
			message: `bundled brain template (--brain obsidian default; args[3] is YAML null until /aide:brain config fills it)`,
		};
	})();

	// Step 2 — MCP entry: the only helper that can throw (malformed JSON). Runs
	// AFTER the brain.aide scaffold. If it throws, propagate immediately; the IIFE
	// catch block converts the throw to a stderr error line and exits 1.
	const mcpRaw = await writeMcpEntry(cwd);
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
	// compare bytes, and map "would-skip" → "exists".
	const versionsHostPath = join(cwd, path.dirname(config.docHubDir), "versions.json");
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
	await applySteps(toApply);

	// Step 7 — Build the per-file log input. Brain.aide result is first
	// (always present), MCP result is second, then every planned step in order.
	const results: InstallResult[] = [brainScaffoldResult, mcpResult];

	for (const step of plannedSteps) {
		const displayPath = path.relative(cwd, step.filePath).split(path.sep).join("/");

		if (step.status === "would-create") {
			results.push({ status: "created", displayPath, message: step.name });
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

	// Step 10 — Render and write the warning block. Brain wiring and IDE
	// configuration are always deferred via the two-item deferredCategories() array.
	const warning = renderWarning({
		skipped: warningSkipped,
		failed: warningFailed,
		deferredCategories: deferredCategories(),
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
 * Parse `--brain <name>` or `--brain=<name>` from argv. Returns the validated
 * integration name, defaulting to `"obsidian"` when the flag is absent.
 *
 * Throws on empty value or on an unknown integration name not in
 * `BRAIN_INTEGRATIONS`.
 */
function parseBrain(argv: readonly string[]): string {
	const equalsForm = argv.find((a) => a.startsWith("--brain="));
	if (equalsForm) {
		const value = equalsForm.slice("--brain=".length).trim();
		if (value.length === 0) {
			throw new Error(
				`--brain requires a value. Registered integrations: ${BRAIN_INTEGRATIONS.join(", ")}.`,
			);
		}
		if (!(BRAIN_INTEGRATIONS as readonly string[]).includes(value)) {
			throw new Error(
				`Unknown --brain value "${value}". Registered integrations: ${BRAIN_INTEGRATIONS.join(", ")}.`,
			);
		}
		return value;
	}

	const idx = argv.indexOf("--brain");
	if (idx !== -1) {
		if (idx + 1 >= argv.length || argv[idx + 1].startsWith("-")) {
			throw new Error(
				`--brain requires a value. Registered integrations: ${BRAIN_INTEGRATIONS.join(", ")}.`,
			);
		}
		const value = argv[idx + 1].trim();
		if (value.length === 0) {
			throw new Error(
				`--brain requires a value. Registered integrations: ${BRAIN_INTEGRATIONS.join(", ")}.`,
			);
		}
		if (!(BRAIN_INTEGRATIONS as readonly string[]).includes(value)) {
			throw new Error(
				`Unknown --brain value "${value}". Registered integrations: ${BRAIN_INTEGRATIONS.join(", ")}.`,
			);
		}
		return value;
	}

	return "obsidian";
}

/**
 * Scan argv for any forbidden brain-shaped flag whose value is a backend-specific
 * datum. On detection, throw a clear error naming the offending flag and routing
 * the user to `/aide:brain config`.
 *
 * The forbidden set covers every flag the old install accepted plus common variants.
 * Both the bare-flag form (`--brain-path`) and the equals form
 * (`--brain-path=/foo`) are matched.
 *
 * Does NOT consume `--brain` (without a hyphen suffix) — that is `parseBrain`'s
 * flag.
 */
function assertNoForbiddenFlags(argv: readonly string[]): void {
	for (const arg of argv) {
		for (const flag of FORBIDDEN_BRAIN_FLAGS) {
			if (arg === flag || arg.startsWith(`${flag}=`)) {
				throw new Error(
					`Backend-specific flag ${flag} is not accepted at install time. Run /aide:brain config inside Claude Code on the first /aide run to wire the brain.`,
				);
			}
		}
	}
}

(async () => {
	if (process.argv.includes("--help")) {
		process.stdout.write(
			"Usage: npx aidemd-mcp init [--brain <integration>] [--ide <choice>]\n\n" +
				"What it installs:\n" +
				"  The complete methodology layer into the current project: the methodology\n" +
				"  pointer stub, the methodology doc set under .aide/docs/, every pipeline\n" +
				"  slash command under .claude/commands/aide/, every pipeline agent definition\n" +
				"  under .claude/agents/aide/, every skill template under .claude/skills/, the\n" +
				"  aide MCP server entry additively merged into .mcp.json, the aide-tree\n" +
				"  launcher at .aide/bin/aide-tree.mjs, the README badge, and the bundled\n" +
				"  brain.aide template selected by --brain at .aide/config/brain.aide (with\n" +
				"  YAML null at the unwired slot). Never overwrites existing files.\n\n" +
				"What it does NOT do:\n" +
				"  Never writes a .mcp.json brain entry (sync owns that, after the null slot\n" +
				"  is filled). Never seeds the four entry-point artifacts (coding-playbook,\n" +
				"  study-playbook, update-playbook, research index). Never creates the brain\n" +
				"  root directory. Never asks for a brain path, token, connection URI, or any\n" +
				"  other backend-specific value. Never accepts any backend-shaped flag\n" +
				"  (--brain-path, --vault-path, --brain-root, --brain-token, --brain-url,\n" +
				"  --brain-name).\n\n" +
				"Recognized flags:\n" +
				"  --help                  Print this message and exit.\n" +
				"  --brain <integration>   Select which bundled template scaffolds. Today the\n" +
				"                          only valid value is obsidian (the default when\n" +
				"                          --brain is omitted). Future integrations land their\n" +
				"                          own bundled templates and become valid --brain values\n" +
				"                          without changing this contract.\n" +
				"  --ide <choice>          Select which IDE preview wiring scaffolds. (Not yet\n" +
				"                          implemented; see todo.aide.)\n\n" +
				"Post-install follow-up:\n" +
				"  Brain wiring       — open Claude Code and run /aide; on the first run,\n" +
				"                       /aide:brain config will fill the unwired slot in\n" +
				"                       .aide/config/brain.aide, derive the brain MCP entry\n" +
				"                       through cli/sync, and seed the four entry-point\n" +
				"                       artifacts into your brain.\n" +
				"  Deferred IDE       — re-run: npx aidemd-mcp init --ide <choice>\n" +
				"  Skipped artifacts  — run /aide:upgrade for guided reconciliation.\n",
		);
		process.exit(0);
	}

	try {
		assertNoForbiddenFlags(process.argv.slice(2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(1);
	}

	try {
		const brain = parseBrain(process.argv.slice(2));
		const code = await runInit(process.cwd(), undefined, { brain });
		process.exit(code);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(1);
	}
})();
