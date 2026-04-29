import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { InitStep, McpPrescription } from "@/types/index.js";
import parseBrainAide, { interpolateArgs, parseBrainAideFromString } from "@/service/parseBrainAide/index.js";
import obsidianBrainAideTemplate from "./obsidianBrainAideTemplate/index.js";

/** Check if a path exists. */
async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/** Read a file, returning empty string if it doesn't exist. */
async function safeReadFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}

/**
 * Parse the brain.aide content that would be in effect after this install and return
 * the derived MCP server entry.
 *
 * Dispatch logic:
 * - `would-create` + `content` defined → cold-install path: parse the in-memory template
 *   bytes via `parseBrainAideFromString` (no I/O; brain.aide has not hit disk yet).
 * - Otherwise → on-disk path: brain.aide already exists; parse from the file via
 *   `parseBrainAide(projectRoot)`.
 *
 * Returns `{ command, args }` on a successful parse (`kind === "ok"`). `args` is typed
 * `(string | null)[]` — null entries forwarded verbatim from the parsed brain.aide are
 * preserved at their original indexes. This helper does not introspect or substitute
 * null at any index; slot-semantic knowledge lives exclusively in the per-integration
 * `config` body section owned by the user.
 *
 * Returns `null` on any non-ok parse result. The MCP step falls back to an empty
 * prescription when null is returned.
 */
async function resolveBrainAideConfig(
	projectRoot: string,
	brainAideStep: InitStep,
): Promise<{ command: string; args: (string | null)[] } | null> {
	let parseResult;

	if (brainAideStep.status === "would-create" && brainAideStep.content !== undefined) {
		// In-memory path: parse the template bytes directly without any I/O.
		parseResult = parseBrainAideFromString(brainAideStep.content);
	} else {
		// On-disk path: brain.aide already exists — parse from the file.
		parseResult = await parseBrainAide(projectRoot);
	}

	if (parseResult.kind !== "ok") return null;

	const { name, mcpServerConfig } = parseResult;
	return {
		command: mcpServerConfig.command,
		args: interpolateArgs({ name, mcpServerConfig }),
	};
}

/**
 * Build the brain.aide config file planning step.
 *
 * Presence-only (seed-semantic) idempotency — if the file exists at `.aide/config/brain.aide`
 * within the host project root, the step is `exists`. The file lives under `.aide/config/`,
 * the host's user-owned configuration directory established by the root spec. The
 * seed-semantic invariant (never `would-overwrite`) applies to every path under `.aide/config/`,
 * not just brain.aide — the directory boundary is the ownership signal, not a per-file
 * allowlist. provisionBrain never returns `would-overwrite` for any file under `.aide/config/`.
 *
 * When the file is absent, the bundled template bytes are emitted as `content`. The template
 * is called with no arguments and emits YAML null at every unwired slot in
 * `mcpServerConfig.args` — the structural unwired-slot signal rather than a literal sentinel.
 */
async function buildBrainAideStep(projectRoot: string): Promise<InitStep> {
	const filePath = join(projectRoot, ".aide", "config", "brain.aide");

	if (await exists(filePath)) {
		return {
			name: "Brain config (brain.aide)",
			status: "exists",
			category: "brain",
			filePath,
		};
	}

	// Absent — scaffold the bundled default brain.aide bytes. The template is the single
	// source of launcher bytes; the MCP step derives from it. No brainPath argument —
	// the template emits YAML null at the unwired path slot regardless of caller.
	const content = obsidianBrainAideTemplate();
	return {
		name: "Brain config (brain.aide)",
		status: "would-create",
		category: "brain",
		filePath,
		content,
	};
}

/**
 * Build the brain MCP wiring planning step.
 *
 * The expected entry is ALWAYS derived from the scaffolded brain.aide bytes via
 * `resolveBrainAideConfig` (parseBrainAide + interpolateArgs) — never constructed inline.
 * `prescription.entry.args` may carry `null` entries when the brain.aide path slot is YAML
 * null (the unwired state). The step emits the same shape regardless — sync (downstream)
 * refuses to write null-bearing args, so a partially-wired brain configuration cannot
 * silently land in `.mcp.json`.
 *
 * Four on-disk states of `.mcp.json` are handled:
 *   1. File absent or empty → `would-create`.
 *   2. `mcpServers.brain` absent → `would-create`.
 *   3. `mcpServers.brain` present and matches derived entry → `exists`.
 *   4. `mcpServers.brain` present and differs from derived entry → `would-overwrite`.
 *
 * Malformed JSON → `would-create` with `configMalformed: true`.
 *
 * Comparison is element-by-element `===` on both command and args. This correctly handles
 * null: `null === null` is `true`, `null === "string"` is `false`. No additional
 * null-coercion code is needed.
 */
async function buildBrainMcpStep(
	projectRoot: string,
	brainAideStep: InitStep,
	mcpConfigPath: string,
): Promise<InitStep> {
	// Derive the expected MCP entry from the scaffolded brain.aide.
	const expectedEntry = await resolveBrainAideConfig(projectRoot, brainAideStep);

	// Build the prescription from the derived entry. When parsing failed (corrupt template —
	// should not happen in practice), expectedEntry is null and the prescription uses an empty
	// fallback so the MCP step still reports would-create rather than crashing.
	const prescription: McpPrescription = {
		key: "brain",
		entry: expectedEntry ?? { command: "", args: [] },
	};

	const existing = await safeReadFile(mcpConfigPath);

	// Branch 1: No MCP config file yet — cold install.
	if (!existing) {
		return {
			name: "MCP config (brain)",
			status: "would-create",
			category: "mcp",
			filePath: mcpConfigPath,
			prescription,
		};
	}

	try {
		const config = JSON.parse(existing);
		const servers = config.mcpServers || {};
		const hasBrain = "brain" in servers;

		// Branch 2: `mcpServers.brain` absent — plan creation.
		if (!hasBrain) {
			return {
				name: "MCP config (brain)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		}

		// Branch 3/4: `mcpServers.brain` present — compare element-by-element.
		// `===` handles null correctly: null === null is true, null === "string" is false.
		const existing_entry = servers.brain as { command?: unknown; args?: unknown };
		const commandMatches = existing_entry.command === prescription.entry.command;
		const argsMatch =
			Array.isArray(existing_entry.args) &&
			existing_entry.args.length === prescription.entry.args.length &&
			(existing_entry.args as unknown[]).every((a, i) => a === prescription.entry.args[i]);

		if (commandMatches && argsMatch) {
			return {
				name: "MCP config (brain)",
				status: "exists",
				category: "mcp",
				filePath: mcpConfigPath,
			};
		}

		// Entry differs — overwrite to match derived entry.
		return {
			name: "MCP config (brain)",
			status: "would-overwrite",
			category: "mcp",
			filePath: mcpConfigPath,
			prescription,
		};
	} catch {
		// Malformed JSON — plan creation and flag the issue.
		return {
			name: "MCP config (brain)",
			status: "would-create",
			category: "mcp",
			filePath: mcpConfigPath,
			prescription,
			configMalformed: true,
		};
	}
}

/**
 * Plan the brain-layer scaffolding as exactly TWO InitStep records and write nothing to disk.
 *
 * Returns `[brainAideStep, mcpStep]` in fixed order:
 *   1. Brain config (brain.aide) — presence-only idempotency on `.aide/config/brain.aide`.
 *      Absent → `would-create` with the bundled template bytes (YAML null at every unwired
 *      slot of `mcpServerConfig.args`). Present → `exists` with no `content` field. Never
 *      returns `would-overwrite` for any path under `.aide/config/`.
 *   2. MCP config (brain) — derives the prescription from the just-scaffolded (or on-disk)
 *      brain.aide via parseBrainAide + interpolateArgs. Handles four states of `.mcp.json`
 *      (absent/empty → would-create; brain key absent → would-create; brain key present and
 *      matches → exists; brain key present and differs → would-overwrite) plus malformed-JSON
 *      (would-create + configMalformed: true).
 *
 * YAML-null contract: the bundled template emits null at unwired slots; the null propagates
 * verbatim through parseBrainAide and interpolateArgs into the MCP step's prescription;
 * sync (downstream) refuses to write null-bearing args. The four entry-point artifacts
 * (playbook, study-playbook, update-playbook, research) and the brain root directory are NOT
 * this module's responsibility — they are seeded by the integration's `aide-config` body
 * section prose at first `/aide:brain config` via the brain's MCP write tool, after the
 * user fills the null slot(s) and runs sync.
 *
 * @param projectRoot - Host project root (where `.aide/config/brain.aide` lives).
 * @param mcpConfigPath - Absolute path to the host's `.mcp.json`.
 */
export default async function provisionBrain(
	projectRoot: string,
	mcpConfigPath: string,
): Promise<InitStep[]> {
	const brainAideStep = await buildBrainAideStep(projectRoot);
	const mcpStep = await buildBrainMcpStep(projectRoot, brainAideStep, mcpConfigPath);
	return [brainAideStep, mcpStep];
}
