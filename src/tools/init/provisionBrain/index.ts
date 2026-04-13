import { readFile, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:os";
import type { InitStep, McpPrescription } from "@/types/index.js";

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

/** Build the Obsidian MCP server entry, wrapping with cmd /c on Windows. */
function obsidianMcpEntry(brainPath: string): McpPrescription["entry"] {
	if (platform() === "win32") {
		return { command: "cmd", args: ["/c", "npx", "@bitbonsai/mcpvault", brainPath] };
	}
	return { command: "npx", args: ["@bitbonsai/mcpvault", brainPath] };
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
- **Everything else** (project context, journal logs, research, domain knowledge, tasks) → use \`mcp__obsidian__search_notes\` with query terms matching the domain.

## Where to Find Things

| What you need | Where to look |
|---------------|---------------|
| Coding conventions, patterns | \`study-playbook\` skill (not search) |
| Project context, goals, status | \`projects/<project>.md\` |
| Tasks for a project | \`kanban/board.md\` |
| Session logs, prior work | \`journal/log/\` (search by project name or topic) |
| Research, reference material | \`research/\` (search by domain) |
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
 * Return planning steps for brain vault scaffolding and Obsidian MCP wiring.
 *
 * The function signature requires a resolved `brainPath` — the caller (agent)
 * guarantees a path is provided before calling. Returns four `InitStep` items:
 *
 * 1. Vault scaffolding (category `"brain"`): `exists` if vault is already
 *    populated, `would-create` with the directories list as JSON content.
 * 2. Playbook hub (category `"brain"`): `exists` if `coding-playbook/coding-playbook.md`
 *    is present, `would-create` with the five-section Markdown template when absent.
 *    Idempotency is per-file — checked independently of the vault-level step.
 * 3. Vault CLAUDE.md (category `"brain"`): `exists` if `CLAUDE.md` is present at the
 *    vault root, `would-create` with the navigation guide template when absent.
 *    Idempotency is per-file — checked independently of the vault-level step.
 * 4. Obsidian MCP entry (category `"mcp"`): `exists` if the obsidian key is
 *    already in the config, `would-create` with a `McpPrescription`.
 *    If the config file is malformed JSON, returns `would-create` with
 *    `configMalformed: true`.
 *
 * No step writes to disk — this helper is a planner only.
 */
export default async function provisionBrain(
	brainPath: string,
	mcpConfigPath: string,
): Promise<InitStep[]> {
	const vaultStep = await buildVaultStep(brainPath);
	const playbookHubStep = await buildPlaybookHubStep(brainPath);
	const vaultClaudeMdStep = await buildVaultClaudeMdStep(brainPath);
	const mcpStep = await buildObsidianMcpStep(brainPath, mcpConfigPath);

	return [vaultStep, playbookHubStep, vaultClaudeMdStep, mcpStep];
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

/** Build the playbook hub template planning step, with per-file idempotency. */
async function buildPlaybookHubStep(brainPath: string): Promise<InitStep> {
	const filePath = join(brainPath, "coding-playbook", "coding-playbook.md");

	if (await exists(filePath)) {
		return {
			name: "Playbook hub",
			status: "exists",
			category: "brain",
			filePath,
		};
	}

	return {
		name: "Playbook hub",
		status: "would-create",
		category: "brain",
		filePath,
		content: PLAYBOOK_HUB_TEMPLATE,
	};
}

/** Build the vault-root CLAUDE.md planning step, with per-file idempotency. */
async function buildVaultClaudeMdStep(brainPath: string): Promise<InitStep> {
	const filePath = join(brainPath, "CLAUDE.md");

	if (await exists(filePath)) {
		return {
			name: "Vault CLAUDE.md",
			status: "exists",
			category: "brain",
			filePath,
		};
	}

	return {
		name: "Vault CLAUDE.md",
		status: "would-create",
		category: "brain",
		filePath,
		content: VAULT_CLAUDE_MD_TEMPLATE,
	};
}

/** Build the Obsidian MCP wiring planning step. */
async function buildObsidianMcpStep(brainPath: string, mcpConfigPath: string): Promise<InitStep> {
	const prescription: McpPrescription = {
		key: "obsidian",
		entry: obsidianMcpEntry(brainPath),
	};

	const existing = await safeReadFile(mcpConfigPath);

	if (existing) {
		try {
			const config = JSON.parse(existing);
			const servers = config.mcpServers || {};
			if ("obsidian" in servers) {
				return {
					name: "MCP config (obsidian)",
					status: "exists",
					category: "mcp",
					filePath: mcpConfigPath,
				};
			}
			return {
				name: "MCP config (obsidian)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
			};
		} catch {
			return {
				name: "MCP config (obsidian)",
				status: "would-create",
				category: "mcp",
				filePath: mcpConfigPath,
				prescription,
				configMalformed: true,
			};
		}
	}

	return {
		name: "MCP config (obsidian)",
		status: "would-create",
		category: "mcp",
		filePath: mcpConfigPath,
		prescription,
	};
}
