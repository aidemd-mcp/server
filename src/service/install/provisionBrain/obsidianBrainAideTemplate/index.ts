import { platform } from "node:os";

/**
 * Returns the complete canonical Obsidian `brain.aide` file content as a string,
 * ready to write to disk at `.aide/config/brain.aide` in the host project root.
 *
 * Load-bearing decisions:
 * - This is the SINGLE source of canonical Obsidian brain.aide bytes for the
 *   entire package. The legacy `obsidianMcpEntry()` is replaced by parsing this
 *   template via `parseBrainAideFromString` and calling `interpolateArgs`.
 * - Frontmatter is exactly `name` + `mcpServerConfig` — minimum schema is the
 *   maximum schema. The parser rejects any additional top-level field
 *   (`connector`, `rootPath`, `entryFile`, `tools`) as `malformed-frontmatter`.
 * - The vault path is inlined byte-for-byte as the last element of `args`.
 *   This template does NOT use `${rootPath}` or any other placeholder — the
 *   package does not own the substitution path for the default scaffold.
 * - Platform branching: Windows uses `command: cmd` with `["/c", "npx", ...]`
 *   args to work around Windows shell constraints. POSIX uses `command: npx`
 *   directly. The platform check is isolated here and nowhere else in this module.
 * - The prose body is the full agent-facing brain.aide prose body. It names
 *   the `mcp__brain__read_note` and `mcp__brain__search_notes` tools and describes
 *   the wikilink crawling protocol.
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
		`across every note in the vault. The vault's entry file is \`CLAUDE.md\` at the\n` +
		`vault root — read that first; it carries wikilinks (\`[[note-name]]\`) you follow\n` +
		`to deepen context. When a wikilink looks relevant to your task, read it (depth 1)\n` +
		`and check that note's links too. Stay in scope; don't follow links into unrelated\n` +
		`topics.\n`
	);
}
