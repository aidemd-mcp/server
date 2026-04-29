import { readFile, access, readdir } from "node:fs/promises";
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

/**
 * Check if a brain root directory is already populated at brainPath.
 *
 * Heuristic (Obsidian-flavored): returns true if the `.obsidian` directory is
 * present — that directory is a strong signal the path is an initialized
 * Obsidian brain. For any other brain backend, the directory-non-empty fallback
 * catches it: if the brain root contains any files or folders (placed there by
 * the user's chosen storage), the brain is considered populated. The function
 * does not dispatch on backend identity — it returns true when the directory is
 * non-empty by any heuristic.
 */
async function brainRootExists(brainPath: string): Promise<boolean> {
	// Obsidian-flavored heuristic: .obsidian/ directory signals an initialized brain.
	if (await exists(join(brainPath, ".obsidian"))) return true;

	try {
		const entries = await readdir(brainPath);
		return entries.length > 0;
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

/** The brain root directories that init scaffolds into a fresh brain. */
const BRAIN_ROOT_DIRS = ["research", "process/retro", "coding-playbook"] as const;

/**
 * Resolve the entry-point artifact body bytes from the brain.aide that would be in effect after this install.
 *
 * This helper is the SINGLE source of entry-point artifact body bytes for the install pipeline.
 * The package no longer owns entry-point bytes as inline TypeScript constants; brain.aide is the
 * authoritative source. Both the in-memory cold-install path and the on-disk existing-file
 * path round-trip through the same parser (`parseBrainAideFromString` / `parseBrainAide`),
 * yielding the same field shape — the two paths are structurally identical.
 *
 * Dispatch logic:
 * - `would-create` + `content` defined → cold-install path: parse the in-memory template
 *   bytes via `parseBrainAideFromString` (no I/O; brain.aide has not hit disk yet).
 * - Otherwise → on-disk path: brain.aide already exists; parse from the file via
 *   `parseBrainAide(projectRoot)`.
 *
 * Returns `{ playbookIndex, studyPlaybook, updatePlaybook, researchIndex }` on a successful
 * parse (`kind === "ok"`). Only the four install-time-seed keys are destructured;
 * `orientation` and `config` are deliberately not read — they are live agent-facing
 * sections, not install seeds, and this module has no reason to inspect them.
 * Returns `null` on any non-ok result (`missing`, `malformed-frontmatter`, `malformed-body`).
 * Entry-point artifact step builders fall back to `would-skip` when this returns `null`, surfacing
 * an actionable remediation message to the user.
 */
async function resolveBrainAideBody(
	projectRoot: string,
	brainAideStep: InitStep,
): Promise<{ playbookIndex: string; studyPlaybook: string; updatePlaybook: string; researchIndex: string } | null> {
	let parseResult;

	if (brainAideStep.status === "would-create" && brainAideStep.content !== undefined) {
		// In-memory path: parse the template bytes directly without any I/O.
		parseResult = parseBrainAideFromString(brainAideStep.content);
	} else {
		// On-disk path: brain.aide already exists — parse from the file.
		parseResult = await parseBrainAide(projectRoot);
	}

	if (parseResult.kind !== "ok") return null;

	const { playbookIndex, studyPlaybook, updatePlaybook, researchIndex } = parseResult;
	return { playbookIndex, studyPlaybook, updatePlaybook, researchIndex };
}

/**
 * Parse the brain.aide content that would be in effect after this install.
 *
 * For a `would-create` step, the content is already in memory (from the template).
 * For an `exists` step, read and parse from disk via `parseBrainAide`.
 * Returns `null` when parsing fails — the MCP step falls back to `would-create`.
 */
async function resolveBrainAideConfig(
	projectRoot: string,
	brainAideStep: InitStep,
): Promise<{ command: string; args: string[] } | null> {
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
 * Return planning steps for brain config scaffolding, brain root directory scaffolding,
 * entry-point artifact scaffolding, and brain MCP wiring.
 *
 * When `brainPath` is omitted the function is in bootstrap mode — it scaffolds brain.aide
 * so the user can later run `/aide:brain config` to supply a real brain root path. In that
 * mode the bundled template emits the literal `<BRAIN_PATH>` sentinel into `mcpServerConfig.args`,
 * and that sentinel propagates verbatim through `parseBrainAide` and `interpolateArgs` into
 * the MCP step's `prescription.entry.args`. No code in this module inspects or substitutes
 * the sentinel value. The brain-root step and the four artifact-step builders each receive
 * `brainPath ?? ""` — an empty string makes their `join`-derived paths nonsense, so the
 * brain-root presence check returns false (benign `would-create` the caller may ignore) and
 * the artifact steps likewise emit `would-create` with content sourced from the scaffolded
 * brain.aide. Callers that need correct filesystem-backed planning must supply a real path.
 *
 * Entry-point artifact bytes are sourced from brain.aide body sections via `parseBrainAide` /
 * `parseBrainAideFromString`; this module never holds entry-point bytes as inline TypeScript
 * constants.
 *
 * Returns seven `InitStep` items in order:
 *
 * 1. Brain config (brain.aide) — `would-create` with bundled default bytes when absent;
 *    `exists` when present. Written to `.aide/config/brain.aide`. Seed-semantic idempotency —
 *    never `would-overwrite` because the file is user-owned the moment it lands. The
 *    directory-level rule applies to every future inhabitant of `.aide/config/`: nothing
 *    under that directory may ever return `would-overwrite`. When `brainPath` is omitted the
 *    template emits the literal `<BRAIN_PATH>` sentinel in the args slot.
 * 2. Brain root directories — `would-create` with the directories list as JSON content when
 *    the brain root is empty; `exists` when populated.
 * 3. Playbook entry-point artifact — `would-create` with content sourced from the scaffolded
 *    brain.aide's `playbookIndex` body section delimited by the
 *    `<!-- aide-playbook-index-start -->` and `<!-- aide-playbook-index-end -->` markers when
 *    absent; `exists` when present. Seed-semantic idempotency.
 * 4. Study-playbook entry-point artifact — `would-create` with content sourced from the
 *    scaffolded brain.aide's `studyPlaybook` body section delimited by the
 *    `<!-- aide-study-playbook-start -->` and `<!-- aide-study-playbook-end -->` markers when
 *    absent; `exists` when present. Artifact path: `coding-playbook/study-playbook.md`.
 *    Presence-only idempotency (seed-semantic).
 * 5. Update-playbook entry-point artifact — `would-create` with content sourced from the
 *    scaffolded brain.aide's `updatePlaybook` body section delimited by the
 *    `<!-- aide-update-playbook-start -->` and `<!-- aide-update-playbook-end -->` markers when
 *    absent; `exists` when present. Artifact path: `coding-playbook/update-playbook.md`.
 *    This is an install-time seed (not an `aide_brain` `kind`) — the shipped
 *    `/aide:update-playbook` slash command points at this on-disk artifact the same way the
 *    `study-playbook` skill points at `coding-playbook/study-playbook.md`. Presence-only
 *    idempotency (seed-semantic).
 * 6. Research entry-point artifact — `would-create` with content sourced from the scaffolded
 *    brain.aide's `researchIndex` body section delimited by the
 *    `<!-- aide-research-index-start -->` and `<!-- aide-research-index-end -->` markers when
 *    absent; `exists` when present. Seed-semantic idempotency.
 * 7. Brain MCP entry — `would-create` for cold installs; `would-overwrite` for legacy
 *    `obsidian`-keyed installs, transitional both-keys states, or entry drift; `exists`
 *    if the brain key is present with a matching entry (derived from the scaffolded
 *    brain.aide). If the config file is malformed JSON, returns `would-create` with
 *    `configMalformed: true`. The MCP step prescription is ALWAYS derived from the
 *    scaffolded brain.aide bytes — never constructed inline. When `brainPath` was omitted the
 *    derived entry's `args` carries the literal `<BRAIN_PATH>` sentinel, and the step emits
 *    the same shape regardless.
 *
 * Two idempotency modes coexist: seed-semantic (presence-only) for user-owned
 * content (steps 1–6); canonical-derived (entry comparison) for the MCP
 * prescription (step 7).
 *
 * No step writes to disk — this helper is a planner only.
 *
 * @param projectRoot - Host project root (where `.aide/config/brain.aide` lives).
 * @param brainPath - Optional brain root directory path. When omitted, the bundled template
 *   emits the literal `<BRAIN_PATH>` sentinel and bootstrap mode is in effect.
 * @param mcpConfigPath - Absolute path to the host's `.mcp.json`.
 */
export default async function provisionBrain(
	projectRoot: string,
	brainPath: string | undefined,
	mcpConfigPath: string,
): Promise<InitStep[]> {
	// Step 1: Plan the brain config file. Runs first so steps 3–6 can derive
	// their content from the scaffolded bytes. Lives under .aide/config/, the
	// user-owned configuration directory — never returns would-overwrite.
	// When brainPath is omitted the template emits the literal <BRAIN_PATH> sentinel.
	const brainAideStep = await buildBrainAideStep(projectRoot, brainPath);

	// Resolve the effective brain path for the filesystem-backed steps.
	// Option 1 (caller responsibility): pass brainPath ?? "" to the builders that
	// require a real path. An empty brainPath makes join paths nonsense; the
	// presence checks return false and emit benign would-create steps. The caller
	// is responsible for supplying a real path when filesystem correctness matters.
	const effectiveBrainPath = brainPath ?? "";

	// Step 2: Plan the brain root directory tree.
	const brainRootStep = await buildBrainRootStep(effectiveBrainPath);

	// Step 3: Plan the playbook entry-point artifact. Content sourced from the
	// scaffolded brain.aide's playbookIndex body section between
	// `<!-- aide-playbook-index-start -->` and `<!-- aide-playbook-index-end -->` via
	// parseBrainAide / parseBrainAideFromString. Presence-only idempotency (seed-semantic).
	const playbookStep = await buildPlaybookStep(
		projectRoot, effectiveBrainPath, brainAideStep,
	);

	// Step 4: Plan the study-playbook entry-point artifact. Content sourced from the
	// scaffolded brain.aide's studyPlaybook body section between
	// `<!-- aide-study-playbook-start -->` and `<!-- aide-study-playbook-end -->` via the
	// same parser pass that powers steps 3, 5, and 6. Presence-only idempotency (seed-semantic).
	const studyPlaybookStep = await buildStudyPlaybookStep(
		projectRoot, effectiveBrainPath, brainAideStep,
	);

	// Step 5: Plan the update-playbook entry-point artifact. Content sourced from the
	// scaffolded brain.aide's updatePlaybook body section between
	// `<!-- aide-update-playbook-start -->` and `<!-- aide-update-playbook-end -->` via the
	// same parser pass that powers steps 3, 4, and 6. Presence-only idempotency (seed-semantic).
	const updatePlaybookStep = await buildUpdatePlaybookStep(
		projectRoot, effectiveBrainPath, brainAideStep,
	);

	// Step 6: Plan the research entry-point artifact. Content sourced from the
	// scaffolded brain.aide's researchIndex body section between
	// `<!-- aide-research-index-start -->` and `<!-- aide-research-index-end -->` via the
	// same parser pass that powers steps 3, 4, and 5. Presence-only idempotency (seed-semantic).
	const researchStep = await buildResearchStep(
		projectRoot, effectiveBrainPath, brainAideStep,
	);

	// Step 7: Plan the brain MCP entry. Prescription derived from the scaffolded
	// brain.aide's frontmatter via parseBrainAide + interpolateArgs. Four
	// migration branches: cold install, legacy obsidian-only, transitional
	// both-keys, drift on the brain key. When brainPath was omitted the derived
	// args carry the literal <BRAIN_PATH> sentinel verbatim.
	const mcpStep = await buildBrainMcpStep(
		projectRoot, brainAideStep, mcpConfigPath,
	);

	return [
		brainAideStep, brainRootStep,
		playbookStep, studyPlaybookStep, updatePlaybookStep, researchStep, mcpStep,
	];
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
 * When `brainPath` is undefined the template emits the literal `<BRAIN_PATH>` sentinel in the
 * `mcpServerConfig.args` slot. The sentinel is a parser-blind literal — no `${...}` substitution
 * occurs. The bytes are forwarded to `obsidianBrainAideTemplate(brainPath)` unchanged; the
 * placeholder branch lives entirely in the template helper.
 */
async function buildBrainAideStep(projectRoot: string, brainPath: string | undefined): Promise<InitStep> {
	const filePath = join(projectRoot, ".aide", "config", "brain.aide");

	if (await exists(filePath)) {
		return {
			name: "Brain config (brain.aide)",
			status: "exists",
			category: "brain",
			filePath,
		};
	}

	// Absent — scaffold the bundled default brain.aide bytes. The template
	// is the single source of launcher bytes; the MCP step derives from it.
	const content = obsidianBrainAideTemplate(brainPath);
	return {
		name: "Brain config (brain.aide)",
		status: "would-create",
		category: "brain",
		filePath,
		content,
	};
}

/** Build the brain root directory scaffolding planning step. */
async function buildBrainRootStep(brainPath: string): Promise<InitStep> {
	if (await brainRootExists(brainPath)) {
		return {
			name: "Brain root directories",
			status: "exists",
			category: "brain",
			filePath: brainPath,
		};
	}

	return {
		name: "Brain root directories",
		status: "would-create",
		category: "brain",
		filePath: brainPath,
		content: JSON.stringify(BRAIN_ROOT_DIRS),
	};
}

/**
 * Build the playbook entry-point artifact planning step.
 *
 * Presence-only check — if the file exists at its expected path, the step is
 * `exists` regardless of on-disk content. Once the user has the file, the bytes
 * belong to the user. See the spec's Strategy section ("Two different idempotency
 * semantics coexist in this module") for the rationale behind seed-semantic
 * idempotency vs. the canonical-derived check used by `buildBrainMcpStep`.
 *
 * The artifact's path (`coding-playbook/coding-playbook.md`) is a framework
 * contract — the `study-playbook` skill navigates to this location regardless
 * of which storage backend the user wires. Content is sourced from the
 * scaffolded brain.aide's `playbookIndex` body section between
 * `<!-- aide-playbook-index-start -->` and `<!-- aide-playbook-index-end -->` via
 * `resolveBrainAideBody`.
 */
async function buildPlaybookStep(
	projectRoot: string,
	brainPath: string,
	brainAideStep: InitStep,
): Promise<InitStep> {
	const filePath = join(brainPath, "coding-playbook", "coding-playbook.md");

	if (await exists(filePath)) {
		return { name: "Playbook entry-point", status: "exists", category: "brain", filePath };
	}

	const body = await resolveBrainAideBody(projectRoot, brainAideStep);
	if (body === null) {
		return {
			name: "Playbook entry-point",
			status: "would-skip",
			category: "brain",
			filePath,
			instructions: "Brain config (brain.aide) failed to parse — fix it and re-run.",
		};
	}

	return {
		name: "Playbook entry-point",
		status: "would-create",
		category: "brain",
		filePath,
		content: body.playbookIndex,
	};
}

/**
 * Build the study-playbook entry-point artifact planning step.
 *
 * Presence-only check — if the file exists at its expected path, the step is
 * `exists` regardless of on-disk content. Once the user has the file, the bytes
 * belong to the user. See the spec's Strategy section ("Two different idempotency
 * semantics coexist in this module") for the rationale behind seed-semantic
 * idempotency vs. the canonical-derived check used by `buildBrainMcpStep`.
 *
 * The artifact's path (`coding-playbook/study-playbook.md`) is a framework
 * contract — the agent-side `study-playbook` skill points at this artifact
 * regardless of which storage backend the user wires. Content is sourced from
 * the scaffolded brain.aide's `studyPlaybook` body section between
 * `<!-- aide-study-playbook-start -->` and `<!-- aide-study-playbook-end -->` via
 * `resolveBrainAideBody`, the same parser pass that powers the playbook and update-playbook
 * entry-point steps.
 */
async function buildStudyPlaybookStep(
	projectRoot: string,
	brainPath: string,
	brainAideStep: InitStep,
): Promise<InitStep> {
	const filePath = join(brainPath, "coding-playbook", "study-playbook.md");

	if (await exists(filePath)) {
		return { name: "Study-playbook entry-point", status: "exists", category: "brain", filePath };
	}

	const body = await resolveBrainAideBody(projectRoot, brainAideStep);
	if (body === null) {
		return {
			name: "Study-playbook entry-point",
			status: "would-skip",
			category: "brain",
			filePath,
			instructions: "Brain config (brain.aide) failed to parse — fix it and re-run.",
		};
	}

	return {
		name: "Study-playbook entry-point",
		status: "would-create",
		category: "brain",
		filePath,
		content: body.studyPlaybook,
	};
}

/**
 * Build the update-playbook entry-point artifact planning step.
 *
 * Presence-only check — if the file exists at its expected path, the step is
 * `exists` regardless of on-disk content. Once the user has the file, the bytes
 * belong to the user. See the spec's Strategy section ("Two different idempotency
 * semantics coexist in this module") for the rationale behind seed-semantic
 * idempotency vs. the canonical-derived check used by `buildBrainMcpStep`.
 *
 * The artifact's path (`coding-playbook/update-playbook.md`) is a framework
 * contract — the shipped `/aide:update-playbook` slash command points at this
 * on-disk artifact the same way the `study-playbook` skill points at
 * `coding-playbook/study-playbook.md`. This is an install-time seed, not an
 * `aide_brain` `kind`. Content is sourced from the scaffolded brain.aide's
 * `updatePlaybook` body section between `<!-- aide-update-playbook-start -->` and
 * `<!-- aide-update-playbook-end -->` via `resolveBrainAideBody`, the same parser
 * pass that powers the playbook, study-playbook, and research entry-point steps.
 */
async function buildUpdatePlaybookStep(
	projectRoot: string,
	brainPath: string,
	brainAideStep: InitStep,
): Promise<InitStep> {
	const filePath = join(brainPath, "coding-playbook", "update-playbook.md");

	if (await exists(filePath)) {
		return { name: "Update-playbook entry-point", status: "exists", category: "brain", filePath };
	}

	const body = await resolveBrainAideBody(projectRoot, brainAideStep);
	if (body === null) {
		return {
			name: "Update-playbook entry-point",
			status: "would-skip",
			category: "brain",
			filePath,
			instructions: "Brain config (brain.aide) failed to parse — fix it and re-run.",
		};
	}

	return {
		name: "Update-playbook entry-point",
		status: "would-create",
		category: "brain",
		filePath,
		content: body.updatePlaybook,
	};
}

/**
 * Build the research entry-point artifact planning step.
 *
 * Presence-only check — if the file exists at its expected path, the step is
 * `exists` regardless of on-disk content. Once the user has the file, the bytes
 * belong to the user. Seed-semantic idempotency matches `buildPlaybookStep`.
 *
 * The artifact's path (`research/research.md`) is a framework contract — the
 * research entry-point artifact lives here regardless of storage backend. Content is
 * sourced from the scaffolded brain.aide's `researchIndex` body section between
 * `<!-- aide-research-index-start -->` and `<!-- aide-research-index-end -->` via
 * `resolveBrainAideBody`, the same parser pass that powers the playbook entry-point step.
 */
async function buildResearchStep(
	projectRoot: string,
	brainPath: string,
	brainAideStep: InitStep,
): Promise<InitStep> {
	const filePath = join(brainPath, "research", "research.md");

	if (await exists(filePath)) {
		return { name: "Research entry-point", status: "exists", category: "brain", filePath };
	}

	const body = await resolveBrainAideBody(projectRoot, brainAideStep);
	if (body === null) {
		return {
			name: "Research entry-point",
			status: "would-skip",
			category: "brain",
			filePath,
			instructions: "Brain config (brain.aide) failed to parse — fix it and re-run.",
		};
	}

	return {
		name: "Research entry-point",
		status: "would-create",
		category: "brain",
		filePath,
		content: body.researchIndex,
	};
}

/**
 * Build the brain MCP wiring planning step.
 *
 * The expected entry is ALWAYS derived from the scaffolded brain.aide bytes —
 * never constructed inline. Six on-disk states are handled:
 *   - Malformed JSON → `would-create` with `configMalformed: true`.
 *   - Cold (neither `brain` nor `obsidian` key present) → `would-create`.
 *   - Legacy (`obsidian` only) → `would-overwrite` migrating to key `brain`.
 *   - Transitional (both `obsidian` and `brain`) → `would-overwrite`.
 *   - Brain present, entry matches derived entry → `exists`.
 *   - Brain present, entry differs → `would-overwrite`.
 *
 * When the caller omitted `brainPath`, the derived entry's `args` carries the literal
 * `<BRAIN_PATH>` sentinel string. The step emits the same shape regardless — no
 * defensive substitution or branch on the sentinel value. `interpolateArgs` passes it
 * through unchanged because it is not a `${...}` interpolation target.
 */
async function buildBrainMcpStep(
	projectRoot: string,
	brainAideStep: InitStep,
	mcpConfigPath: string,
): Promise<InitStep> {
	// Derive the expected MCP entry from the scaffolded brain.aide.
	const expectedEntry = await resolveBrainAideConfig(projectRoot, brainAideStep);

	// Build the prescription from the derived entry. When parsing failed (corrupt
	// template — should not happen in practice), expectedEntry is null and the
	// prescription uses an empty fallback so the MCP step still reports would-create
	// rather than crashing. The user will need to fix their brain.aide.
	const prescription: McpPrescription = {
		key: "brain",
		entry: expectedEntry ?? { command: "", args: [] },
	};

	const existing = await safeReadFile(mcpConfigPath);

	// No MCP config file yet — cold install.
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
		const hasObsidian = "obsidian" in servers;

		// Both keys present (transitional half-migrated state) — emit would-overwrite
		// so the agent re-confirms. A separate follow-up cleans the orphan obsidian key.
		if (hasBrain && hasObsidian) {
			return {
				name: "MCP config (brain)",
				status: "would-overwrite",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		}

		// Only the brain key is present — compare the full entry against the derived
		// expected entry. Structural comparison: command equality + element-by-element
		// args equality. Any divergence means would-overwrite (brain.aide was edited).
		if (hasBrain) {
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

			// Brain key present but entry differs — overwrite to match derived entry.
			return {
				name: "MCP config (brain)",
				status: "would-overwrite",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		}

		// Only the legacy obsidian key is present — migrate to brain.
		if (hasObsidian) {
			return {
				name: "MCP config (brain)",
				status: "would-overwrite",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		}

		// Neither key present — cold install.
		return {
			name: "MCP config (brain)",
			status: "would-create",
			category: "mcp",
			filePath: mcpConfigPath,
			prescription,
		};
	} catch {
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
