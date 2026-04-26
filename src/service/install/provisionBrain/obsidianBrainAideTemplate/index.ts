import { platform } from "node:os";

/**
 * Returns the complete canonical Obsidian `brain.aide` file content as a string,
 * ready to write to disk at `.aide/brain.aide` in the host project root.
 *
 * Load-bearing decisions:
 * - This is the SINGLE source of canonical Obsidian brain.aide bytes for the
 *   entire package. The legacy `obsidianMcpEntry()` is replaced by parsing this
 *   template via `parseBrainAideFromString` and calling `interpolateArgs`.
 * - The `${rootPath}` string in `mcpServerConfig.args` is a literal placeholder —
 *   this function does NOT pre-interpolate it. The user sees `${rootPath}` in the
 *   file alongside the resolved `rootPath` field. Interpolation is the consumer's
 *   job at install/sync time via `interpolateArgs`.
 * - Platform branching: Windows uses `command: cmd` with `["/c", "npx", ...]`
 *   args to work around Windows shell constraints. POSIX uses `command: npx`
 *   directly. The platform check is isolated here and nowhere else in this module.
 * - The prose body is the full agent-facing brain.aide prose body, per the
 *   parseBrainAide canonical fixture and the plan's spec good example. It names
 *   the `mcp__brain__read_note` and `mcp__brain__search_notes` tools and describes
 *   the wikilink crawling protocol. The retired `brainBackends` registry previously
 *   held a shorter 3-sentence version of this prose as a server-side template
 *   constant; that approach is replaced entirely by the user owning the prose
 *   verbatim in their hand-written `brain.aide` file.
 */
export default function obsidianBrainAideTemplate(rootPath: string): string {
	const mcpServerConfig =
		platform() === "win32"
			? `mcpServerConfig:\n  command: cmd\n  args:\n    - "/c"\n    - "npx"\n    - "-y"\n    - "obsidian-mcp"\n    - "\${rootPath}"`
			: `mcpServerConfig:\n  command: npx\n  args:\n    - "-y"\n    - "obsidian-mcp"\n    - "\${rootPath}"`;

	return (
		`---\n` +
		`connector: obsidian\n` +
		`rootPath: ${rootPath}\n` +
		`entryFile: CLAUDE.md\n` +
		`${mcpServerConfig}\n` +
		`tools:\n` +
		`  read: mcp__brain__read_note\n` +
		`  search: mcp__brain__search_notes\n` +
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
