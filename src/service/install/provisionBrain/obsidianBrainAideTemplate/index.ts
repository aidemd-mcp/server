import { platform } from "node:os";

/**
 * Returns the complete canonical Obsidian `brain.aide` file content as a string,
 * ready to write to disk at `.aide/config/brain.aide` in the host project root.
 *
 * Format spec: `.aide/docs/brain-aide.md`.
 *
 * The returned string has three body sections in this order:
 *
 * 1. **`## Prose`** — Agent-facing instructions for navigating an Obsidian vault.
 *    Names the `mcp__brain__read_note` and `mcp__brain__search_notes` tools and
 *    describes the wikilink crawling protocol. User-editable post-scaffold.
 *
 * 2. **`## Playbook hub`** — Seed bytes for the coding-playbook hub note scaffolded
 *    into the user's brain vault on cold install (`coding-playbook/coding-playbook.md`).
 *    Carried forward from the legacy `PLAYBOOK_HUB_TEMPLATE` constant in
 *    `provisionBrain/index.ts`. User-editable post-scaffold; the template seeds once.
 *
 * 3. **`## Research hub`** — Seed bytes for the research hub note scaffolded into
 *    the user's brain vault on cold install (`research/research.md`). Brand-new
 *    content modeled on the Playbook hub's structural shape. User-editable
 *    post-scaffold; the template seeds once.
 *
 * Load-bearing constraints:
 * - Frontmatter is exactly `name` + `mcpServerConfig` — minimum schema is the
 *   maximum schema. The parser rejects any additional top-level field as
 *   `malformed-frontmatter`.
 * - The vault path is inlined byte-for-byte as the last element of `args`.
 *   This template does NOT use `${rootPath}` or any other placeholder — the
 *   package does not own the substitution path for the default scaffold.
 * - Platform branching: Windows uses `command: cmd` with `["/c", "npx", ...]`
 *   args to work around Windows shell constraints. POSIX uses `command: npx`
 *   directly. The platform check is isolated here and nowhere else in this module.
 * - Nested headings inside any section MUST use `### ` or deeper (never `## `)
 *   so the parser's closed-vocabulary walker does not treat them as section
 *   boundaries. Every top-level `## ` in the template body IS a section boundary.
 */
export default function obsidianBrainAideTemplate(rootPath: string): string {
	const mcpServerConfig =
		platform() === "win32"
			? `mcpServerConfig:\n  command: cmd\n  args:\n    - '/c'\n    - 'npx'\n    - '@bitbonsai/mcpvault'\n    - '${rootPath}'`
			: `mcpServerConfig:\n  command: npx\n  args:\n    - '@bitbonsai/mcpvault'\n    - '${rootPath}'`;

	return (
		`---\n` +
		`name: obsidian\n` +
		`${mcpServerConfig}\n` +
		`---\n` +
		`\n` +
		`## Prose\n` +
		`\n` +
		`Your brain is an Obsidian vault. Use \`mcp__brain__read_note\` to open files by\n` +
		`their vault-relative path. Use \`mcp__brain__search_notes\` for keyword queries\n` +
		`across every note in the vault. The vault has two entry hubs: the coding-playbook\n` +
		`hub at \`coding-playbook/coding-playbook.md\` and the research hub at\n` +
		`\`research/research.md\`. Start from the relevant hub for your task, follow\n` +
		`wikilinks (\`[[note-name]]\`) to deepen context, and check those notes' links too.\n` +
		`Stay in scope; don't follow links into unrelated topics.\n` +
		`\n` +
		`## Playbook hub\n` +
		`\n` +
		`# Coding Playbook\n` +
		`\n` +
		`### Task Routing\n` +
		`\n` +
		`| Task domain | Section |\n` +
		`|-------------|---------|\n` +
		`\n` +
		`### How to Use This Index\n` +
		`\n` +
		`Read this note first. Each section links to a **section hub** that lists its notes with keywords. Navigate to the section relevant to your task, then drill into the specific notes you need. Do not read all sections — only the ones whose keywords match the work.\n` +
		`\n` +
		`### Always Read First\n` +
		`\n` +
		`These notes are **required reading** for every task, regardless of which section you're working in:\n` +
		`\n` +
		`1. **[[your-conventions-note]]** — Add your naming, function ordering, and code hygiene conventions here.\n` +
		`2. **[[your-folder-structure-note]]** — Add your folder layout and progressive disclosure conventions here.\n` +
		`\n` +
		`### Sections\n` +
		`\n` +
		`### Contents\n` +
		`\n` +
		`## Research hub\n` +
		`\n` +
		`# Research\n` +
		`\n` +
		`### Domains\n` +
		`\n` +
		`| Domain | Notes |\n` +
		`|--------|-------|\n` +
		`\n` +
		`### How to Use This Index\n` +
		`\n` +
		`Research notes are filed by domain. Each subdirectory holds notes for a single domain; read the domain hub before drilling into individual notes. Do not flat-search across every domain — the structure is the navigation.\n` +
		`\n` +
		`### Domain Hubs\n` +
		`\n` +
		`Add domain hubs here as your research grows. Each hub lives at \`<domain>/<domain>.md\` and lists its child notes with keywords.\n` +
		`\n` +
		`### Contents\n`
	);
}
