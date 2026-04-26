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

/** Check if a vault already exists at brainPath (.obsidian/ dir present, or directory is non-empty). */
async function vaultExists(brainPath: string): Promise<boolean> {
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

/** The vault directories that init scaffolds into a fresh vault. */
const VAULT_DIRS = ["research", "process/retro", "coding-playbook"] as const;

/** Markdown template for the vault-root CLAUDE.md. Covers vault navigation only:
 * wikilink crawling protocol, decision protocol, where-to-find-things table, and
 * the brain's role in AIDE. Contains no project-specific instructions or user config. */
const VAULT_CLAUDE_MD_TEMPLATE = `# Brain Vault Navigation

## Brain's Role in AIDE

The vault is the pipeline's durable memory. Research agents write domain findings into it, QA agents promote retros, and the coding playbook captures engineering conventions that survive across projects. Without the vault, agents cannot persist or retrieve knowledge across runs — each session starts from scratch.

## Wikilink Crawling Protocol

When reading any vault note, follow \`[[wikilinks]]\` that are relevant to your current task. The rules:

- **Hub notes** (tagged \`hub\` or acting as section indexes) are navigation, not content. Read all wikilinks in their \`## Subnotes\` section to get the full context of that domain. Hubs do not count toward depth.
- **Content notes** are where depth starts (depth 0). When reading a content note, look for \`[[wikilinks]]\` in the body. If a linked note looks relevant to the task, read it (depth 1). Check *that* note's links too — go at least 1–2 levels deep from the first content note in any direction where the information could apply.
- **Never re-read.** If a note is already in your conversation context from a prior read, skip it. This applies across skill invocations and manual reads within the same session.
- **Stay in scope.** Wikilinks that point outside the current domain of interest can be skipped. Follow links that deepen understanding of the task, not links that branch into unrelated topics.

## Decision Protocol

There are two lookup paths — use the right one:

- **Coding conventions and patterns** → use the \`study-playbook\` skill. It navigates the coding playbook hub top-down (hub → section hub → content notes → wikilinks). Do NOT flat-search for playbook content with \`search_notes\` — the hub structure gives you the full picture; search gives you fragments.
- **Everything else** (project context, journal logs, research, domain knowledge, tasks) → use \`mcp__brain__search_notes\` with query terms matching the domain.

## Where to Find Things

| What you need | Where to look |
|---------------|---------------|
| Coding conventions, patterns | \`study-playbook\` skill (not search) |
| Domain research, reference material | \`research/\` (search by domain) |
| QA retros, process learnings | \`process/retro/\` |
`;

/** Markdown template for the coding-playbook hub note. Contains the five-section
 * structure the study-playbook skill's crawling protocol expects — headings and
 * table skeleton are present, all content rows and entries are left empty. */
const PLAYBOOK_HUB_TEMPLATE = `# Coding Playbook

## Task Routing

| Task domain | Section |
|-------------|---------|

---

## How to Use This Index

Read this note first. Each section links to a **section hub** that lists its notes with keywords. Navigate to the section relevant to your task, then drill into the specific notes you need. Do not read all sections — only the ones whose keywords match the work.

---

## Always Read First

These notes are **required reading** for every task, regardless of which section you're working in:

1. **[[your-conventions-note]]** — Add your naming, function ordering, and code hygiene conventions here.
2. **[[your-folder-structure-note]]** — Add your folder layout and progressive disclosure conventions here.

---

## Sections

---

## Contents
`;

/**
 * Return planning steps for brain.aide scaffolding, vault scaffolding, and brain MCP wiring.
 *
 * Requires a resolved `brainPath` (vault location) and `projectRoot` (host project root).
 * Returns five `InitStep` items in order:
 *
 * 1. Brain config (category `"brain"`): `would-create` with the canonical Obsidian
 *    brain.aide bytes when absent; `exists` when present. Written to `.aide/config/brain.aide`.
 *    Seed-semantic idempotency — never `would-overwrite` because the file is user-owned
 *    the moment it lands. The directory-level rule applies to every future inhabitant of
 *    `.aide/config/`: nothing under that directory may ever return `would-overwrite`.
 * 2. Vault scaffolding (category `"brain"`): `exists` if vault is already populated,
 *    `would-create` with the directories list as JSON content.
 * 3. Playbook hub (category `"brain"`): `exists` when the file is present at its
 *    expected path; `would-create` with `content` when absent. Seed-semantic.
 * 4. Vault CLAUDE.md (category `"brain"`): `exists` when present; `would-create` when
 *    absent. Seed-semantic.
 * 5. Brain MCP entry (category `"mcp"`): `exists` if the brain key is present with a
 *    matching entry (derived from the scaffolded brain.aide); `would-create` for cold
 *    installs; `would-overwrite` for legacy `obsidian`-keyed installs, transitional
 *    states, or entry drift. If the config file is malformed JSON, returns `would-create`
 *    with `configMalformed: true`. The MCP step prescription is ALWAYS derived from the
 *    scaffolded brain.aide bytes — never constructed inline.
 *
 * Two idempotency modes coexist: seed-semantic (presence-only) for user-owned
 * content (steps 1, 2, 3, 4); canonical-derived (entry comparison) for the MCP
 * prescription (step 5).
 *
 * No step writes to disk — this helper is a planner only.
 *
 * @param projectRoot - Host project root (where `.aide/config/brain.aide` lives).
 * @param brainPath - Resolved vault directory path.
 * @param mcpConfigPath - Absolute path to the host's `.mcp.json`.
 */
export default async function provisionBrain(
	projectRoot: string,
	brainPath: string,
	mcpConfigPath: string,
): Promise<InitStep[]> {
	// Step 1: Plan the brain.aide config file. This step runs first so that steps
	// downstream (especially the MCP step) can derive their prescription from it.
	// This step writes under .aide/config/, which the install layer treats as user-owned
	// the moment any file lands inside it — neither this step nor any future step that
	// touches .aide/config/ may return would-overwrite.
	const brainAideStep = await buildBrainAideStep(projectRoot, brainPath);

	// Steps 2–4: Vault scaffolding, playbook hub, and vault CLAUDE.md.
	const vaultStep = await buildVaultStep(brainPath);
	const playbookHubStep = await buildPlaybookHubStep(brainPath);
	const vaultClaudeMdStep = await buildVaultClaudeMdStep(brainPath);

	// Step 5: MCP wiring — derived from the scaffolded brain.aide bytes.
	// The content to parse comes from whichever path was resolved above:
	//   - would-create: the in-memory template bytes (brainAideStep.content)
	//   - exists: the on-disk bytes at the brain.aide path
	const mcpStep = await buildBrainMcpStep(projectRoot, brainAideStep, mcpConfigPath);

	return [brainAideStep, vaultStep, playbookHubStep, vaultClaudeMdStep, mcpStep];
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
 */
async function buildBrainAideStep(projectRoot: string, brainPath: string): Promise<InitStep> {
	const filePath = join(projectRoot, ".aide", "config", "brain.aide");

	if (await exists(filePath)) {
		return {
			name: "Brain config (brain.aide)",
			status: "exists",
			category: "brain",
			filePath,
		};
	}

	// Absent — scaffold the canonical Obsidian brain.aide bytes. The template
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

/** Build the vault scaffolding planning step. */
async function buildVaultStep(brainPath: string): Promise<InitStep> {
	if (await vaultExists(brainPath)) {
		return {
			name: "Brain vault",
			status: "exists",
			category: "brain",
			filePath: brainPath,
		};
	}

	return {
		name: "Brain vault",
		status: "would-create",
		category: "brain",
		filePath: brainPath,
		content: JSON.stringify(VAULT_DIRS),
	};
}

/**
 * Build the playbook hub template planning step.
 *
 * Presence-only check — if the file exists at its expected path, the step is
 * `exists` regardless of on-disk content. Once the user has the file, the bytes
 * belong to the user. See the spec's Strategy section ("Two different idempotency
 * semantics coexist in this module") for the rationale behind seed-semantic
 * idempotency vs. the canonical-derived check used by `buildBrainMcpStep`.
 */
async function buildPlaybookHubStep(brainPath: string): Promise<InitStep> {
	const filePath = join(brainPath, "coding-playbook", "coding-playbook.md");

	if (await exists(filePath)) {
		return { name: "Playbook hub", status: "exists", category: "brain", filePath };
	}

	return {
		name: "Playbook hub",
		status: "would-create",
		category: "brain",
		filePath,
		content: PLAYBOOK_HUB_TEMPLATE,
	};
}

/**
 * Build the vault-root CLAUDE.md planning step.
 *
 * Presence-only check — if the file exists at its expected path, the step is
 * `exists` regardless of on-disk content. Once the user has the file, the bytes
 * belong to the user. See the spec's Strategy section ("Two different idempotency
 * semantics coexist in this module") for the rationale behind seed-semantic
 * idempotency vs. the canonical-derived check used by `buildBrainMcpStep`.
 */
async function buildVaultClaudeMdStep(brainPath: string): Promise<InitStep> {
	const filePath = join(brainPath, "CLAUDE.md");

	if (await exists(filePath)) {
		return { name: "Vault CLAUDE.md", status: "exists", category: "brain", filePath };
	}

	return {
		name: "Vault CLAUDE.md",
		status: "would-create",
		category: "brain",
		filePath,
		content: VAULT_CLAUDE_MD_TEMPLATE,
	};
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

	const { config } = parseResult;
	return {
		command: config.mcpServerConfig.command,
		args: interpolateArgs(config),
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
