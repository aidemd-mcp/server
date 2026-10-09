import { platform } from "node:os";

/**
 * Returns the complete canonical bundled `brain.aide` file content as a string,
 * ready to write to disk at `.aide/config/brain.aide` in the host project root.
 *
 * Takes no arguments. The path slot in `mcpServerConfig.args` is always YAML null
 * in the emitted output — the structural unwired-slot signal carried by the typed
 * `(string | null)[]` schema. The agent fills the null slot with the user's real
 * path via `/aide:brain config`, then runs sync; sync writes the wired entry to
 * `.mcp.json` and refuses to write null-bearing args. The integration's
 * `<!-- aide-config-start -->` body section carries the full wiring flow prose,
 * including the post-sync seeding step, which reads the published section
 * contract instead of restating a list of artifacts.
 *
 * The returned string has eight body sections. The authoritative list, order and
 * per-section roles are owned by `@/service/brainContract`; the parser enforces
 * it and this template must carry a block for every entry. By role:
 *
 * - **Live sections** are read at runtime from the brain config and never written
 *   into the brain. `orientation` is the agent-facing briefing `aide_brain` returns
 *   (tools to reach the brain, entry points to start from, and a pointer to the
 *   kanban board and its guide). `config` is the Obsidian wiring and seeding flow
 *   `/aide:brain config` runs. Both are user-editable post-scaffold.
 *
 * - **Seed sections** are install-time bytes written into the user's brain at
 *   their contract `seedPath`, once, when absent. All are user-editable
 *   post-scaffold:
 *   - the coding-playbook index, the study-playbook navigation methodology, the
 *     update-playbook maintenance methodology (backend-agnostic: no MCP tool
 *     names) and the research index;
 *   - `kanban-board`: the empty board, five columns in order, with no frontmatter
 *     so it stays backend-agnostic;
 *   - `work-kanban`: the kanban working guide, a full port of the create, work,
 *     manage, move, complete, stash and review procedures with every gate and
 *     format kept. It is storage-agnostic (no backend vocabulary, no tool names)
 *     and never references AIDE, so the same guide serves non-AIDE projects.
 *
 * Load-bearing constraints:
 * - Frontmatter is exactly `name` + `mcpServerConfig` — minimum schema is the
 *   maximum schema. The parser rejects any additional top-level field as
 *   `malformed-frontmatter`.
 * - The path slot in `mcpServerConfig.args` is a bare-dash YAML null line in
 *   every emission. POSIX: `args` parses to `["@bitbonsai/mcpvault", null]`.
 *   Win32: `args` parses to `["/c", "npx", "@bitbonsai/mcpvault", null]`. No
 *   quoted empty string, no literal-string sentinel, no `${...}` interpolation
 *   at the unwired slot. The user fills the slot via `/aide:brain config`.
 * - Platform branching: Windows uses `command: cmd` with `["/c", "npx", ...]`
 *   args to work around Windows shell constraints. POSIX uses `command: npx`
 *   directly. The platform check is isolated here and nowhere else in this module.
 * - Heading levels: the playbook-index and study-playbook sections use `## ` for
 *   top-level sub-sections under their `# ` title, since these sections are seeded
 *   into standalone files where `## ` is the natural sub-heading level. The
 *   update-playbook section uses `## ` sub-sections under `# Update Playbook`.
 *   The research-index section keeps `### ` only (its top-level structure is shallow).
 *   The kanban board and guide use `## ` under their `# ` titles. The orientation
 *   and config sections have no headings.
 * - Retired marker names (`aide-prose-*`, `aide-playbook-*` without `-index`,
 *   `aide-research-*` without `-index`) are gone. The parser treats them as plain
 *   bytes and returns `malformed-body` (missing markers) for any brain.aide that
 *   still uses the old four-section grammar.
 */
export default function obsidianBrainAideTemplate(): string {
	const mcpServerConfig =
		platform() === "win32"
			? `mcpServerConfig:\n  command: cmd\n  args:\n    - '/c'\n    - 'npx'\n    - '@bitbonsai/mcpvault'\n    -`
			: `mcpServerConfig:\n  command: npx\n  args:\n    - '@bitbonsai/mcpvault'\n    -`;

	return (
		`---\n` +
		`name: obsidian\n` +
		`${mcpServerConfig}\n` +
		`---\n` +
		`\n` +
		`<!-- aide-orientation-start -->\n` +
		`\n` +
		`Your brain is an Obsidian-backed knowledge store. Use \`mcp__brain__read_note\` to\n` +
		`open files by their brain-relative path. Use \`mcp__brain__search_notes\` for\n` +
		`keyword queries across every note in the store. The store has four entry-point\n` +
		`artifacts: the coding-playbook index at \`coding-playbook/coding-playbook.md\`, the\n` +
		`study-playbook navigation guide at \`coding-playbook/study-playbook.md\`, the\n` +
		`update-playbook maintenance guide at \`coding-playbook/update-playbook.md\`, and the\n` +
		`research index at \`research/research.md\`. Start from the relevant entry-point for\n` +
		`your task, follow the references it lists to deepen context, and check those\n` +
		`files' references too. Stay in scope; don't follow references into unrelated topics.\n` +
		`\n` +
		`Project work is tracked on the kanban board at \`kanban/board.md\`; follow the guide at \`kanban/work-kanban.md\` to create, work, move, complete, stash, or review cards.\n` +
		`\n` +
		`<!-- aide-orientation-end -->\n` +
		`\n` +
		`<!-- aide-config-start -->\n` +
		`\n` +
		`You are completing the wiring of an Obsidian brain. The required value is the\n` +
		`absolute path to the user's Obsidian vault, to be placed at the last entry of\n` +
		`\`mcpServerConfig.args\` in \`brain.aide\`. YAML null at that position is the\n` +
		`unwired-state signal — it means the brain path has not yet been filled in.\n` +
		`\n` +
		`Argument shape (Obsidian only): \`/aide:brain config [<absolute-path>]\`.\n` +
		`\n` +
		`This flow has two paths that NEVER overlap in the same session: WIRING and\n` +
		`SEEDING. Wiring edits \`brain.aide\` and runs sync, then STOPS — the brain MCP\n` +
		`server only loads at session start, so any newly-wired brain entry is\n` +
		`unreachable until the user restarts Claude Code. Seeding writes the\n` +
		`entry-point artifacts via the brain MCP tools, which only works when the brain\n` +
		`is already wired AND the session has the brain MCP server loaded — i.e., on a\n` +
		`run AFTER the wiring restart.\n` +
		`\n` +
		`1. **Read \`brain.aide\` now and quote the last entry of \`mcpServerConfig.args\`.**\n` +
		`   Open \`brain.aide\` and locate the final entry in the \`mcpServerConfig.args\`\n` +
		`   list. Quote the literal value you observe — either YAML null (an empty entry,\n` +
		`   written as a bare dash with no value) or a string. **Do not proceed without\n` +
		`   quoting it.** YAML null means un-wired; any string value means already wired.\n` +
		`\n` +
		`2. Decide which flow runs:\n` +
		`   - \`$ARGUMENTS\` non-empty → **WIRING** flow. Use \`$ARGUMENTS\` as the target\n` +
		`     path (initial wiring or re-point). Proceed to Step 3.\n` +
		`   - \`$ARGUMENTS\` empty AND last entry is YAML null → **WIRING** flow. Ask the\n` +
		`     user where their vault lives via \`AskUserQuestion\` with \`aide_info.brain.hints\`\n` +
		`     as suggestions plus a "Different location" entry. Use the answer as the\n` +
		`     target path. Proceed to Step 3.\n` +
		`   - \`$ARGUMENTS\` empty AND last entry is a string path → **SEEDING** flow.\n` +
		`     The brain is already wired; skip Steps 3 and 4 entirely and jump to Step 5.\n` +
		`\n` +
		`### WIRING flow — Steps 3, 4 (then STOP at end of 4)\n` +
		`\n` +
		`3. Edit \`brain.aide\` — replace the null at the last entry of \`mcpServerConfig.args\`\n` +
		`   with the absolute path.\n` +
		`\n` +
		`4. **Run sync now via Bash.** Read \`.mcp.json["mcpServers"]["aide"]\`, take its\n` +
		`   \`command\` and \`args\`, append the literal string \`"sync"\`, and execute the\n` +
		`   resulting command via the Bash tool. Quote the exit code. On non-zero, surface\n` +
		`   stderr and stop. On exit 0:\n` +
		`\n` +
		`   **STOP HERE in the WIRING flow.** Do not proceed to Step 5 in the same\n` +
		`   session. The brain MCP server was not loaded at session start (it did not\n` +
		`   exist yet), and sync just wrote the entry; the running session cannot see\n` +
		`   it. Emit this message verbatim and end the flow:\n` +
		`\n` +
		`   > Sync wrote the brain entry. Restart Claude Code so the brain MCP server\n` +
		`   > picks up the new entry, then re-run \`/aide:brain config\` to seed the\n` +
		`   > entry-point artifacts into your brain.\n` +
		`\n` +
		`   **Do not output the sync command for the user to run** — \`/aide:brain config\`\n` +
		`   completes wiring inside the slash-command session, never by handing the user\n` +
		`   a homework command.\n` +
		`\n` +
		`### SEEDING flow — Step 5\n` +
		`\n` +
		`5. **Seed the entry-point artifacts into the brain via the brain MCP tools.**\n` +
		`\n` +
		`   First verify the brain MCP write/list tools are available in this session\n` +
		`   (\`mcp__brain__write_note\`, \`mcp__brain__list_directory\`, etc.). If they are\n` +
		`   NOT available, the brain MCP server has not been loaded in this session. Emit\n` +
		`   this message verbatim and STOP:\n` +
		`\n` +
		`   > The brain MCP server is not loaded in this session. Restart Claude Code,\n` +
		`   > then re-run \`/aide:brain config\` to seed the entry-point artifacts.\n` +
		`\n` +
		`   **Never fall back to native filesystem tools** (Read, Write, Bash \`ls\`,\n` +
		`   Glob, etc.) to inspect or write the brain. The brain is a backend-agnostic\n` +
		`   abstraction; the filesystem is just one possible backing store. Other backends\n` +
		`   (hosted, Mem0, etc.) have no local filesystem at all. If the brain MCP tools\n` +
		`   are unreachable, the correct response is to STOP and ask the user to restart,\n` +
		`   never to improvise via the filesystem.\n` +
		`\n` +
		`   When the brain MCP tools ARE available, read the published section contract: call \`aide_init\` with no arguments (a read-only summary call) and take \`brainContract\` from the step named \`Brain config (brain.aide)\`. For each entry whose \`role\` is \`seed\`: presence-check its \`seedPath\` via \`mcp__brain__list_directory\` (or the read tool); if absent, write the bytes between that section's markers in brain.aide via \`mcp__brain__write_note\` at \`seedPath\`. Skip any artifact that already exists (presence-only check — do not overwrite user-edited content).\n` +
		`\n` +
		`   After the seeding loop completes, emit a brief completion summary naming\n` +
		`   each artifact and whether it was seeded or already present. Do not emit a\n` +
		`   restart message — the brain is fully wired and seeded; the user can now use\n` +
		`   \`/aide\` normally.\n` +
		`\n` +
		`<!-- aide-config-end -->\n` +
		`\n` +
		`<!-- aide-playbook-index-start -->\n` +
		`\n` +
		`# Coding Playbook\n` +
		`\n` +
		`Reference for the conventions and patterns this codebase follows. Read top-down — load only the sections that apply to the current task.\n` +
		`\n` +
		`## Task Routing\n` +
		`\n` +
		`When loading playbook context, match the task domain to the relevant section(s). Read only what applies — do NOT load all sections.\n` +
		`\n` +
		`| Task domain | Section |\n` +
		`|-------------|---------|\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## How to Use This Index\n` +
		`\n` +
		`Each section links to a section hub that lists its notes with keywords. Navigate to the section relevant to your task, then drill into the specific notes you need.\n` +
		`\n` +
		`### Always Read First\n` +
		`\n` +
		`These notes are **required reading** for every task, regardless of which section you're working in. They define the patterns everything else builds on:\n` +
		`\n` +
		`1. **[[your-conventions-note]]** — Add your naming, function ordering, and code hygiene conventions here.\n` +
		`2. **[[your-folder-structure-note]]** — Add your folder layout and progressive disclosure conventions here.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Sections\n` +
		`\n` +
		`Add your top-level playbook sections here, each linked to its section hub note.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Prime Examples\n` +
		`\n` +
		`Add links to reference codebases that demonstrate these patterns in practice.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Contents\n` +
		`\n` +
		`<!-- aide-playbook-index-end -->\n` +
		`\n` +
		`<!-- aide-study-playbook-start -->\n` +
		`\n` +
		`# Study Playbook\n` +
		`\n` +
		`Navigate the coding playbook hub and load only the sections relevant to the current task.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Step 1: Read the Playbook Hub\n` +
		`\n` +
		`Read \`coding-playbook/coding-playbook.md\`.\n` +
		`\n` +
		`The hub lists sections with descriptions. Match your current task domain against\n` +
		`those descriptions to identify which sections apply. Do NOT read all sections —\n` +
		`only the ones whose descriptions overlap with the work at hand.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Step 2: Read the Relevant Section Hubs\n` +
		`\n` +
		`For each matching section, read its hub note (e.g. \`<section>/<section>.md\`).\n` +
		`\n` +
		`Section hubs list their child notes with keywords. Scan the list and identify which\n` +
		`specific child notes overlap with the task. Do NOT read every child — only the ones\n` +
		`whose keywords match the work.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Step 3: Read the Specific Child Notes\n` +
		`\n` +
		`Read the child notes identified in Step 2 (e.g. \`<section>/<child-note>.md\`).\n` +
		`These contain the concrete patterns and code examples to follow.\n` +
		`\n` +
		`---\n` +
		`\n` +
		`## Navigation Rules\n` +
		`\n` +
		`- **Use the hub's link structure, not search.** Do NOT search for playbook content.\n` +
		`  Searching produces fragments without context; the hub structure gives you the full\n` +
		`  picture.\n` +
		`- **Read top-down.** Hub → section hub → child note. Never skip levels.\n` +
		`- **Follow wikilinks 1–2 levels deep from content notes.** Hub notes (tagged \`hub\` or\n` +
		`  acting as section indexes) are navigation — they don't count as depth. Depth starts\n` +
		`  at the first content note you land on. Example:\n` +
		`  - \`coding-playbook.md\` (root hub) → depth 0 (navigation)\n` +
		`  - \`foundations/foundations.md\` (section hub) → depth 0 (navigation)\n` +
		`  - \`foundations/conventions.md\` (content note) → depth 0 (first real content)\n` +
		`  - wikilink from \`conventions.md\` → depth 1\n` +
		`  - wikilink from *that* note → depth 2\n` +
		`\n` +
		`  When reading any content note, look for \`[[wikilinks]]\`. If a linked note looks\n` +
		`  relevant to the task, read it — then check *that* note's links too. Go at least\n` +
		`  1–2 levels deep from the first content note in any direction where the information\n` +
		`  could apply. Playbook notes cross-reference each other (e.g. a services note may\n` +
		`  link to error-handling patterns, which links to API response conventions). Following\n` +
		`  these links is how you build the full picture, not just a fragment.\n` +
		`- **Never re-read notes.** Before reading any note, check whether it already appears\n` +
		`  in your conversation context from earlier in the session. You may return to the\n` +
		`  playbook multiple times across a single workflow — do NOT re-read the playbook hub,\n` +
		`  section hubs, or child notes you have already loaded. The same applies when following\n` +
		`  wikilinks: skip any link whose target you have already read in this session.\n` +
		`- **Approach incrementally, not all at once.** Multi-step work (e.g. planning an\n` +
		`  end-to-end feature) crosses multiple domains — types, then services, then API, then\n` +
		`  client. Do NOT try to load every section upfront. Load what you need for the current\n` +
		`  step. When you move to the next step and realize you're in a new domain without the\n` +
		`  relevant playbook context, return to the playbook hub for that domain. The "never\n` +
		`  re-read" rule keeps repeated visits cheap — you'll skip the hub and any notes already\n` +
		`  loaded, and only read the new sections you actually need.\n` +
		`- **Stop when you have enough.** Within a single invocation, if the step only touches\n` +
		`  one domain (e.g. just API routes), you only need that one section's notes plus\n` +
		`  whatever they link to. Don't load unrelated sections "just in case."\n` +
		`\n` +
		`<!-- aide-study-playbook-end -->\n` +
		`\n` +
		`<!-- aide-update-playbook-start -->\n` +
		`\n` +
		`# Update Playbook\n` +
		`\n` +
		`Maintenance methodology for the coding playbook. The three-layer structure\n` +
		`(root hub → section hubs → child notes) and how to navigate it is described in\n` +
		`\`coding-playbook/study-playbook.md\`; this note covers the operations that\n` +
		`preserve it when adding, modifying, renaming, or removing entries.\n` +
		`\n` +
		`## What Belongs Here\n` +
		`\n` +
		`The playbook holds reusable engineering conventions and patterns — naming\n` +
		`rules, error-handling shapes, fetch patterns, schema conventions, anti-patterns,\n` +
		`testing patterns, etc. It does NOT hold project-specific context (environment,\n` +
		`business rules, in-progress feature notes), domain research, retro findings, or\n` +
		`operational runbooks. Those live in other parts of the brain. If the entry\n` +
		`isn't a rule that survives across projects, it doesn't belong here.\n` +
		`\n` +
		`## Layout\n` +
		`\n` +
		`The playbook lives under \`coding-playbook/\` with this shape:\n` +
		`\n` +
		"```\n" +
		`coding-playbook/\n` +
		`├── coding-playbook.md          ← root hub\n` +
		`├── study-playbook.md           ← navigation methodology\n` +
		`├── update-playbook.md          ← this note\n` +
		`├── prime-examples.md           ← (optional) reference codebases\n` +
		`├── foundations/\n` +
		`│   ├── foundations.md          ← section hub (navigation only)\n` +
		`│   ├── conventions.md          ← child note (rules + code)\n` +
		`│   ├── tooling.md\n` +
		`│   └── anti-patterns.md\n` +
		`├── architecture/\n` +
		`│   ├── architecture.md         ← section hub\n` +
		`│   ├── folder-structure.md\n` +
		`│   ├── data-flow.md\n` +
		`│   └── patterns.md\n` +
		`└── ... (one folder per section)\n` +
		"```\n" +
		`\n` +
		`Paths an updater needs to recognize:\n` +
		`\n` +
		`- Root hub: \`coding-playbook/coding-playbook.md\`\n` +
		`- Section hub: \`coding-playbook/<section>/<section>.md\`\n` +
		`- Child note: \`coding-playbook/<section>/<note>.md\`\n` +
		`\n` +
		`Section hubs (\`<section>/<section>.md\`) hold **no patterns themselves** — only\n` +
		`their \`## Subnotes\` table, \`## When to Read This Section\` list, and the\n` +
		`\`Part of [[coding-playbook/coding-playbook|Coding Playbook]]\` backreference.\n` +
		`Every pattern, rule, and code example lives in child notes.\n` +
		`\n` +
		`Hub notes (root and section) carry frontmatter tags\n` +
		`\`["coding-playbook","hub","context"]\`. Child notes have no required frontmatter\n` +
		`convention.\n` +
		`\n` +
		`## Note Scope (Progressive Disclosure)\n` +
		`\n` +
		`Each child note should be tightly scoped to a single topic an agent might need\n` +
		`to look up — naming, error handling, a specific fetch pattern, etc. Notes are\n` +
		`short and focused, not long catch-alls. Connect related notes with \`[[wikilinks]]\`\n` +
		`so an agent reading one can follow the trail rather than load everything upfront.\n` +
		`\n` +
		`If a note has drifted into multiple topics, or grown past the point where an\n` +
		`agent can scan it quickly, split it: extract each topic into its own child\n` +
		`note, add rows to the section hub's \`## Subnotes\` table for the new notes,\n` +
		`update the root hub's \`## Contents\` list, and replace the moved content in the\n` +
		`original note with a wikilink to the new note. An agent should not have to\n` +
		`parse 500 lines of markdown to learn how to name a variable.\n` +
		`\n` +
		`## Entry Format\n` +
		`\n` +
		`Each rule inside a child note follows a consistent shape so an agent can scan\n` +
		`quickly and learn from concrete examples.\n` +
		`\n` +
		`1. **Lead with the rule.** A bolded one-sentence principle as the first line of\n` +
		`   the section or bullet — e.g. **Name variables after the function that\n` +
		`   produces them.** State the rule plainly; the rest of the entry justifies and\n` +
		`   illustrates it.\n` +
		`\n` +
		`2. **State the reason inline.** One or two sentences explaining *why*. The\n` +
		`   reason is what an agent uses to judge edge cases the rule didn't anticipate.\n` +
		`   Don't split rule and reason across distant sections — they read as a unit.\n` +
		`\n` +
		`3. **Show real code.** Use code blocks in the project's actual language (not\n` +
		`   pseudocode). When the example is lifted from a specific file, prefix the\n` +
		`   block with a provenance HTML comment naming the project and path, e.g.\n` +
		`   \`<!-- from <project-name>: src/path/to/file.ts -->\`, so the source stays\n` +
		`   traceable as the codebase evolves. Only fill in real project names and\n` +
		`   paths — never leave the angle-bracket placeholders in a published note.\n` +
		`\n` +
		`4. **Pair Good and Bad examples.** Most rules have a clear right and wrong\n` +
		`   shape — show both. Tag each block with a one-line reason in a code comment:\n` +
		`   \`// Good — descriptive noun, no redundant suffix\` and\n` +
		`   \`// Bad — Result suffix adds nothing\`. When a rule has multiple failure\n` +
		`   modes (e.g. helpers inline above the export vs. helpers buried below it),\n` +
		`   show one Bad block per failure mode so each is recognizable on its own.\n` +
		`\n` +
		`5. **Cross-link related rules.** Inside the note body, mention adjacent topics\n` +
		`   by wikilink. At the bottom of the note, add a \`See also:\` line listing\n` +
		`   related notes and a \`Part of [[<section>/<section>|<Section>]]\`\n` +
		`   backreference so the navigation tree closes cleanly.\n` +
		`\n` +
		`Goal: an agent landing on a single rule sees the principle, the reasoning, and\n` +
		`concrete code without scrolling, and knows where to follow up if the rule\n` +
		`intersects another topic.\n` +
		`\n` +
		`## Wikilink Format\n` +
		`\n` +
		`Cross-references between notes use full-path wikilinks with a display label,\n` +
		`not bare names:\n` +
		`\n` +
		"```\n" +
		`// Good — full path survives renames elsewhere; label keeps prose readable\n` +
		`[[coding-playbook/foundations/conventions|Conventions]]\n` +
		`\n` +
		`// Bad — bare name is ambiguous if any other note in the vault shares the title\n` +
		`[[Conventions]]\n` +
		"```\n" +
		`\n` +
		`This applies everywhere wikilinks appear: inline references inside child\n` +
		`notes, \`## Subnotes\` table rows in section hubs, \`## Sections\` and \`## Contents\`\n` +
		`entries in the root hub, \`See also:\` lines, and \`Part of\` backreferences.\n` +
		`\n` +
		`## Maintenance Methodology\n` +
		`\n` +
		`1. **Identify the change.** New convention, new child note, new section, rename,\n` +
		`   removal, or general audit. Skip if the user already named it.\n` +
		`\n` +
		`2. **Locate the right layer.** Read the root hub. New conventions usually extend\n` +
		`   an existing child note or land as a new child note inside an existing section.\n` +
		`   Only justify a new section when the topic isn't covered by any existing one.\n` +
		`\n` +
		`3. **Apply the change at the layer it belongs to.**\n` +
		`   - **Edit a child note** for changes inside an existing topic. Follow the\n` +
		`     Entry Format above — rule, reason, real code, Good/Bad pair, cross-links.\n` +
		`     If the change introduces vocabulary an agent might search by, update the\n` +
		`     section hub's \`## Subnotes\` keywords for that note as well. If the edit\n` +
		`     pushes the note beyond a single topic, split it (see Note Scope above).\n` +
		`   - **Add a child note.** Write it using the Entry Format for every rule it\n` +
		`     contains. Add a row to the section hub's \`## Subnotes\` table with\n` +
		`     keywords, append its path to the root hub's \`## Contents\` list, and —\n` +
		`     critically — retrofit the \`See also:\` lines of related existing notes to\n` +
		`     link to the new one. A note that's only reachable from its section hub is\n` +
		`     half-orphaned; agents discover related rules by following neighbor links.\n` +
		`   - **Add a section.** Create \`<section>/<section>.md\` shaped like existing\n` +
		`     section hubs (\`## Subnotes\`, \`## When to Read This Section\`, the\n` +
		`     \`Part of [[coding-playbook/coding-playbook|Coding Playbook]]\`\n` +
		`     backreference, hub frontmatter tags) — and remember section hubs hold\n` +
		`     navigation only, no patterns. Add the section to the root hub's\n` +
		`     \`## Sections\` list with a description, append every child note to\n` +
		`     \`## Contents\`, and add task-domain rows to \`## Task Routing\`.\n` +
		`   - **Rename or remove** a section or child note. Update the section hub, the\n` +
		`     root hub's \`## Sections\` and \`## Contents\`, every wikilink in adjacent\n` +
		`     notes that points at the renamed/removed target (including \`See also:\`\n` +
		`     lines), and the \`## Task Routing\` table.\n` +
		`\n` +
		`4. **Routing-table drift check (required).** Compare the root hub's\n` +
		`   \`## Task Routing\` table against the sections that exist. Each row should point\n` +
		`   to a real section; each section should be reachable from at least one row;\n` +
		`   each new convention added in step 3 should have a row that routes to it.\n` +
		`   Offer to reconcile any drift.\n` +
		`\n` +
		`5. **Subnotes-table drift check (required when a section was touched).** Scan\n` +
		`   the section hub's \`## Subnotes\` table — every child note in \`<section>/\`\n` +
		`   should have a row, and every row should point to a note that still exists.\n` +
		`\n` +
		`6. **Confirm.** Summarize what changed in the child note(s), in the section hub,\n` +
		`   and in the root hub (Sections, Contents, Task Routing).\n` +
		`\n` +
		`<!-- aide-update-playbook-end -->\n` +
		`\n` +
		`<!-- aide-research-index-start -->\n` +
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
		`### Contents\n` +
		`\n` +
		`<!-- aide-research-index-end -->\n` +
		`\n` +
		`<!-- aide-kanban-board-start -->\n` +
		`\n` +
		`# Kanban Board\n` +
		`\n` +
		`Cards are listed under their column, one per line, as \`- [ ] <card-slug> — <title> #<project-tag>\`. Cards in Done use \`- [x]\`. The guide at \`kanban/work-kanban.md\` defines every board operation.\n` +
		`\n` +
		`## Backlog\n` +
		`\n` +
		`## Todo\n` +
		`\n` +
		`## In Progress\n` +
		`\n` +
		`## In Review\n` +
		`\n` +
		`## Done\n` +
		`\n` +
		`<!-- aide-kanban-board-end -->\n` +
		`\n` +
		`<!-- aide-work-kanban-start -->\n` +
		`\n` +
		`# Work Kanban\n` +
		`\n` +
		`The full procedure for working the project's kanban board: create, work, manage, move, complete, stash and review cards. Read Board and Columns, Cards, Project Tag and Reaching the Board first. They are shared by every operation below. Then follow the section for the operation the user asked for, step by step, and do not skip a gate.\n` +
		`\n` +
		`Operations take their inputs from the user's request (a title, a priority, a card slug, a column, or a flag such as \`--backlog\` or \`--done\`). A flag may also be stated in words.\n` +
		`\n` +
		`## Board and Columns\n` +
		`\n` +
		`- The board lives at \`kanban/board.md\`.\n` +
		`- There are five columns, in this order: Backlog, Todo, In Progress, In Review, Done.\n` +
		`- Each column has a folder that holds its cards: \`kanban/backlog/\`, \`kanban/todo/\`, \`kanban/in-progress/\`, \`kanban/in-review/\`, \`kanban/done/\`.\n` +
		`- Each board line is \`- [ ] <card-slug> — <title> #<project-tag>\`. Cards in Done use \`- [x]\`. The line uses the plain slug.\n` +
		`- A moved line goes to the bottom of its target column: just before the blank line that precedes the next column heading, or at the end of the file for Done.\n` +
		`- Entering Done checks the box (\`- [ ]\` becomes \`- [x]\`). Leaving Done unchecks it (\`- [x]\` becomes \`- [ ]\`). Every other move leaves the box unchanged.\n` +
		`- When editing the board, rewrite the whole file and preserve everything above the first column heading exactly as it is.\n` +
		`- A card's folder must match the column its board line sits in. Moving a card means doing both: update the board, then move the file.\n` +
		`\n` +
		`## Cards\n` +
		`\n` +
		`- Each card is one markdown file at \`kanban/<column-folder>/<slug>.md\`.\n` +
		`- Frontmatter:\n` +
		`  - \`tags\`: the project tag and a priority tag (\`p0\`, \`p1\` or \`p2\`);\n` +
		`  - \`created\` and \`updated\`: both \`YYYY-MM-DDTHH:MM:SS\`;\n` +
		`  - \`sessions\`: optional, a list of datetimes, one appended each time a work session starts on the card.\n` +
		`- Body: \`# <Title>\`, then a \`Project: <project-tag>\` line, then the description if there is one.\n` +
		`- Later sections (Stash, Review, Revisions and so on) are appended to the card and never overwrite earlier entries.\n` +
		`- Priorities: \`p0\` is critical or blocking, \`p1\` is high (do soon), \`p2\` is low (nice to have). A card with no priority is treated as \`p2\`. The priority is also called the severity.\n` +
		`- Any operation that changes a card updates its \`updated\` field to the current datetime. \`created\` is never changed.\n` +
		`\n` +
		`## Project Tag\n` +
		`\n` +
		`Every card and every board line carries the project's tag, and operations filter the board by it.\n` +
		`\n` +
		`If the tag is not already known in this session, ask the user which project the work is for and use the answer as the tag. Never guess it. Once known, reuse it for the rest of the session and pass it explicitly to every subagent that needs it.\n` +
		`\n` +
		`## Create\n` +
		`\n` +
		`Create a new card on the board.\n` +
		`\n` +
		`### Delegation rules\n` +
		`\n` +
		`1. Gather user input yourself and delegate everything else. You collect the card details by asking the user with structured options, then pass them to a single subagent call that does all the brain work. This keeps your context clean for whatever runs next.\n` +
		`2. Every subagent call needs three things: a type (\`general-purpose\`, because it needs write access), a short description for the UI, and the full prompt the subagent receives.\n` +
		`3. Ask the user with structured options for the priority and any other choice. Do not dump plain-text questions.\n` +
		`\n` +
		`### Step 1 — Gather card details\n` +
		`\n` +
		`Take whatever the user already provided (title, priority, \`--backlog\` flag).\n` +
		`\n` +
		`- No title provided: ask "What's the task?"\n` +
		`- No priority provided: ask with these options:\n` +
		`  - \`p0\` — critical / blocks work\n` +
		`  - \`p1\` — high / should do soon\n` +
		`  - \`p2\` — low / nice to have\n` +
		`- Title is vague: optionally ask for a short description. Skip this if the title is self-explanatory.\n` +
		`\n` +
		`The target column is Backlog if \`--backlog\` was passed, Todo otherwise.\n` +
		`\n` +
		`After this step you have \`TITLE\`, \`SEVERITY\`, \`DESCRIPTION\` (or none), \`TARGET_COLUMN\` and the project tag (see Project Tag).\n` +
		`\n` +
		`### Step 2 — Create the card\n` +
		`\n` +
		`Make one subagent call (\`general-purpose\`, description "Create kanban task") with this prompt, filled in:\n` +
		`\n` +
		`> You are creating a new card on the kanban board.\n` +
		`>\n` +
		`> **Task title:** \`<TITLE>\`\n` +
		`> **Severity:** \`<SEVERITY>\`\n` +
		`> **Description:** \`<DESCRIPTION or "none">\`\n` +
		`> **Target column:** \`<TARGET_COLUMN>\`\n` +
		`> **Project tag:** \`<project tag, or "none">\`\n` +
		`>\n` +
		`> Use only the brain read, write, move and search tools available in this session.\n` +
		`>\n` +
		`> ## Checklist\n` +
		`>\n` +
		`> - [ ] **Check the project tag.** If the project tag is "none", return \`MODE: NO_PROJECT\` and stop.\n` +
		`> - [ ] **Generate the slug.** Convert the title to a slug: lowercase, replace spaces and special characters with hyphens, strip leading and trailing hyphens, at most 60 characters. Check whether \`<target_folder>/<slug>.md\` already exists. If it does, append \`-2\` (or increment) until it is unique. Target folders: Todo is \`kanban/todo/\`, Backlog is \`kanban/backlog/\`.\n` +
		`> - [ ] **Create the card.** Write \`<target_folder>/<slug>.md\`:\n` +
		`>\n` +
		`>   \`\`\`markdown\n` +
		`>   ---\n` +
		`>   tags:\n` +
		`>     - <project tag>\n` +
		`>     - <severity>\n` +
		`>   created: <YYYY-MM-DDTHH:MM:SS>\n` +
		`>   updated: <YYYY-MM-DDTHH:MM:SS>\n` +
		`>   ---\n` +
		`>\n` +
		`>   # <Task Title>\n` +
		`>\n` +
		`>   Project: <project tag>\n` +
		`>\n` +
		`>   <Description if provided. Otherwise omit this line.>\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`> - [ ] **Add to the board.** Read \`kanban/board.md\`. Insert a new line at the bottom of the target column section (just before the blank line preceding the next \`##\` heading):\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   - [ ] <slug> — <Task Title> #<project tag>\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`>   Write the full board back (overwrite), preserving everything above the first column heading.\n` +
		`> - [ ] **Return in this exact format:**\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   CREATED:\n` +
		`>   SLUG: <slug>\n` +
		`>   PATH: <brain-relative path>\n` +
		`>   SEVERITY: <severity>\n` +
		`>   COLUMN: <target column>\n` +
		`>   PROJECT: <project tag or "unknown">\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`>   If no project tag was supplied: \`MODE: NO_PROJECT\`\n` +
		`\n` +
		`Wait for the subagent result.\n` +
		`\n` +
		`If the result is \`MODE: NO_PROJECT\`, ask the user "Which project is this task for?" Then re-run this step with the answer as the project tag.\n` +
		`\n` +
		`### Step 3 — Confirm and clear\n` +
		`\n` +
		`Tell the user: card created as \`<SLUG>\` (severity: \`<SEVERITY>\`) and added to \`<COLUMN>\`. One line. Then clear the context window (for example with \`/clear\`, where the harness supports it) so the next operation starts fresh.\n` +
		`\n` +
		`## Work\n` +
		`\n` +
		`Pick, investigate and plan the next card from the board, then implement, test and self-review it with strict plan/act mode discipline. Working a card moves it to In Progress and gates all code changes on the user's approval. Use this operation for each card you start. For other board operations use Manage.\n` +
		`\n` +
		`The caller may pass arguments, typically a card slug or a description fragment. They are honored in Step 1 to skip the picker. No arguments falls through to the interactive picker.\n` +
		`\n` +
		`### Architecture\n` +
		`\n` +
		`Board subagents handle all board and brain reads and writes (find, activate, record). They are stateless and disposable.\n` +
		`\n` +
		`The main agent does the investigation, planning, implementation and review directly. This keeps accumulating context in the window so revisions do not pay double serialization costs.\n` +
		`\n` +
		`Do NOT delegate investigation, implementation or review to subagents. Do NOT read the board or the card yourself. Delegate board and brain reads to subagents.\n` +
		`\n` +
		`### Mode discipline\n` +
		`\n` +
		`| Steps | Mode | Rule                                    |\n` +
		`| ----- | ---- | --------------------------------------- |\n` +
		`| 1–5   | Plan | Read, analyze, search. No code changes. |\n` +
		`| 5b    | Act  | Board activation write only.            |\n` +
		`| 6     | Act  | Write code, run type checks, run tests. |\n` +
		`| 7     | Plan | Read and analyze only. No code changes. |\n` +
		`| 8a    | Plan | Re-investigate, present revised plan.   |\n` +
		`| 8b    | Act  | Implement revised plan, run tests.      |\n` +
		`| 8c–8d | Plan | Re-review, present results.             |\n` +
		`\n` +
		`**Transition rule:** After every Act section, re-enter planning mode before doing anything else. Do not make further code changes until explicitly approved.\n` +
		`\n` +
		`### Checklist\n` +
		`\n` +
		`- [ ] **Step 0** — Enter planning mode\n` +
		`- [ ] **Step 1** — Spawn a board subagent to find cards\n` +
		`- [ ] **Step 2** — Present the card table and ask the user to pick (skip if a slug matched)\n` +
		`- [ ] **Step 3** — (deferred — board activation runs at Step 5b after plan approval)\n` +
		`- [ ] **Step 4** — Investigate and plan (main agent, planning mode)\n` +
		`- [ ] **Step 5** — Hard stop: present the plan for approval\n` +
		`- [ ] **Step 5b** — Spawn a board subagent to activate the card (first act after approval)\n` +
		`- [ ] **Step 6** — Implement (main agent, act mode)\n` +
		`- [ ] **Step 7** — Review (main agent, planning mode)\n` +
		`- [ ] **Step 8** — Revision loop (if needed, forward-only)\n` +
		`\n` +
		`### Step 0 — Enter planning mode\n` +
		`\n` +
		`If you are not already in a read-only planning mode, enter it now. Do not proceed until you are in it.\n` +
		`\n` +
		`### Step 1 — Spawn a board subagent: find cards\n` +
		`\n` +
		`Make one subagent call (\`general-purpose\`) with this prompt, filled in:\n` +
		`\n` +
		`> You are finding a card on the kanban board.\n` +
		`>\n` +
		`> **Arguments:** \`<args from the caller, or "none">\`\n` +
		`> **Project tag:** \`<project tag, or "none">\`\n` +
		`>\n` +
		`> Use only the brain read, search and frontmatter tools available in this session.\n` +
		`>\n` +
		`> ## Checklist\n` +
		`>\n` +
		`> - [ ] **Check the project tag.** If the project tag is "none", return \`MODE: NO_PROJECT\`.\n` +
		`> - [ ] **Find the card.**\n` +
		`>\n` +
		`>   **If the arguments contain a card name or slug:** search \`kanban/\` for it. A single match: read its full content and return it as DIRECT. Multiple matches: return all of them for clarification. No match: fall through to the board path.\n` +
		`>\n` +
		`>   **Otherwise:** read \`kanban/board.md\`. For each card line, verify the file exists in the folder matching its column (\`kanban/backlog/\`, \`kanban/todo/\`, and so on). If any file's actual folder does not match its board column, do NOT move it — collect the mismatches for the return output. Filter to lines containing \`#<project tag>\` in **In Progress**, **Todo** and **Backlog** only. Read each card's frontmatter for its priority (\`p0\`/\`p1\`/\`p2\`, default \`p2\`). Return as TABLE.\n` +
		`>\n` +
		`> - [ ] **Return** — one of:\n` +
		`>\n` +
		`>   **DIRECT** (the slug matched one card):\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   MODE: DIRECT\n` +
		`>   PROJECT_TAG: <tag>\n` +
		`>   TASK_SLUG: <slug>\n` +
		`>   TASK_PATH: <brain-relative path>\n` +
		`>   TASK_CONTENT:\n` +
		`>   <full markdown including frontmatter>\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`>   **TABLE** (the user picks):\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   MODE: TABLE\n` +
		`>   PROJECT_TAG: <tag>\n` +
		`>\n` +
		`>   | # | Status | Severity | Task | Description |\n` +
		`>   |---|--------|----------|------|-------------|\n` +
		`>   | 1 | In Progress | p0 | slug | short desc |\n` +
		`>\n` +
		`>   TASK_PATHS:\n` +
		`>   1: kanban/backlog/my-task.md\n` +
		`>\n` +
		`>   TASK_CONTENTS:\n` +
		`>   --- TASK 1 ---\n` +
		`>   <full markdown>\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`>   If there are board/folder mismatches, append:\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   MISMATCHES:\n` +
		`>   - <slug>: board says "<column>" but file is in "<actual folder>"\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`>   Omit MISMATCHES if there are none.\n` +
		`>\n` +
		`>   **NO_TASKS** or **NO_PROJECT**: \`MODE: NO_TASKS\` / \`MODE: NO_PROJECT\`\n` +
		`\n` +
		`### Step 2 — Present and pick\n` +
		`\n` +
		`**First, check for mismatches.** If the response contains a \`MISMATCHES:\` section, present it:\n` +
		`\n` +
		`> These tasks have board/folder mismatches:\n` +
		`> \`<list>\`\n` +
		`> Want me to fix them before continuing, or ignore for now?\n` +
		`\n` +
		`**Hard stop.** If the user says fix, ask: "Move the files to match the board, or update the board to match the files?" Then make a \`general-purpose\` subagent call to apply the chosen direction. After fixing, **re-run Step 1**.\n` +
		`\n` +
		`If the user says ignore, proceed.\n` +
		`\n` +
		`**Then handle the mode:**\n` +
		`\n` +
		`- \`NO_PROJECT\`: ask the user which project. Stop.\n` +
		`- \`NO_TASKS\`: tell the user there are no open cards. Stop.\n` +
		`- \`DIRECT\`: extract the card fields and skip to Step 4.\n` +
		`- \`TABLE\`: display the table verbatim. **Hard stop: "Which task?"** Accept a number, a slug or a description fragment.\n` +
		`\n` +
		`### Step 3 — Deferred\n` +
		`\n` +
		`Board activation is a write operation. It runs after plan approval, at Step 5b, to avoid planning-mode conflicts. The card path, slug and project tag resolved in Step 2 are used there.\n` +
		`\n` +
		`### Step 4 — Investigate and plan (main agent, planning mode)\n` +
		`\n` +
		`You do this directly, with no subagent. Planning mode: read, search and analyze only.\n` +
		`\n` +
		`#### 4a — Load conventions\n` +
		`\n` +
		`Do not proceed to 4b until the conventions are fully loaded into this context window. Do not delegate planning to a subagent — it runs in a fresh context and will not have these conventions.\n` +
		`\n` +
		`Try these sources in order and use the first that succeeds:\n` +
		`\n` +
		`1. The \`study-playbook\` skill. Invoke it, then:\n` +
		`   - read the entry point it returns;\n` +
		`   - identify which sections are relevant to this task;\n` +
		`   - read each relevant section's entry point;\n` +
		`   - read every child file linked from those entry points;\n` +
		`   - only proceed to 4b once all the relevant child files are in context.\n` +
		`2. The project's \`CLAUDE.md\` in the working directory.\n` +
		`3. If neither exists, proceed without conventions and record \`CONVENTIONS: none found\`.\n` +
		`\n` +
		`#### 4b — Load context\n` +
		`\n` +
		`Search the brain with the card's topic keywords for domain context.\n` +
		`\n` +
		`#### 4c — Investigate the codebase\n` +
		`\n` +
		`- Read every file mentioned in the card (full files, not fragments).\n` +
		`- Search for all call sites of functions you expect to change.\n` +
		`- List every file that needs to change and why, including indirect dependents.\n` +
		`\n` +
		`#### 4d — Devise the plan\n` +
		`\n` +
		`The plan must answer:\n` +
		`\n` +
		`- **Root cause** (not symptom): quote specific lines or behavior.\n` +
		`- **Minimal change:** name each file, function or block, and what changes. If multiple approaches exist, list them and justify your choice.\n` +
		`- **Conventions used:** list which conventions from the coding playbook were used.\n` +
		`- **What could go wrong:** side effects, edge cases, anything needing user input.\n` +
		`- **Open questions:** anything ambiguous, or "None".\n` +
		`\n` +
		`Output the plan as a structured checklist.\n` +
		`\n` +
		`#### 4e — Open questions (if any)\n` +
		`\n` +
		`If there are open questions, **hard stop**. Present them to the user. Do not proceed until every question is answered or dismissed.\n` +
		`\n` +
		`### Step 5 — Hard stop: present the plan\n` +
		`\n` +
		`Present the plan to the user verbatim.\n` +
		`\n` +
		`**Hard stop. Do not activate the board or write code until the user approves the plan.**\n` +
		`\n` +
		`Once the user approves, proceed immediately to Step 5b, before writing any code.\n` +
		`\n` +
		`### Step 5b — Spawn a board subagent: activate the card\n` +
		`\n` +
		`You are now in act mode. Make one subagent call (\`general-purpose\`) with this prompt, filled in:\n` +
		`\n` +
		`> You are activating a card — stamping it and moving it to In Progress.\n` +
		`>\n` +
		`> **Card path:** \`<path>\` | **Slug:** \`<slug>\` | **Tag:** \`#<project tag>\` | **Now:** \`<YYYY-MM-DDTHH:MM:SS>\`\n` +
		`>\n` +
		`> Use only the brain read, write, move and frontmatter tools available in this session.\n` +
		`>\n` +
		`> ## Checklist\n` +
		`>\n` +
		`> - [ ] **Check the current status.** If the card path is already under \`kanban/in-progress/\`, this is a resume. Only stamp the session (append the datetime to \`sessions\`, update \`updated\`). Skip the board move and the file move. Return \`DONE (resumed)\`.\n` +
		`> - [ ] **Stamp.** Read the frontmatter, then update it: append the current datetime to the \`sessions\` list (preserve existing entries) and update \`updated\`.\n` +
		`> - [ ] **Move on the board.** Read \`kanban/board.md\`, remove the card's line from its current column, and insert it at the bottom of **In Progress**. Write the full board back (overwrite), preserving everything above the first column heading.\n` +
		`> - [ ] **Move the file.** Move the card to \`kanban/in-progress/<slug>.md\`. Update \`updated\` in the frontmatter.\n` +
		`> - [ ] Return \`DONE\` or \`DONE (resumed)\`.\n` +
		`\n` +
		`Do not proceed to Step 6 until the subagent returns \`DONE\` or \`DONE (resumed)\`.\n` +
		`\n` +
		`### Step 6 — Implement (main agent, act mode)\n` +
		`\n` +
		`You do this directly, with no subagent. Act mode: write code and run tools.\n` +
		`\n` +
		`#### 6a — Implement the changes\n` +
		`\n` +
		`Follow the approved plan. Apply the coding playbook patterns loaded in Step 4a.\n` +
		`\n` +
		`#### 6b — Type check\n` +
		`\n` +
		`Run the project's type checker. Fix all errors before proceeding.\n` +
		`\n` +
		`#### 6c — Write and run tests\n` +
		`\n` +
		`**Mandatory.** Choose the appropriate test type:\n` +
		`\n` +
		`- **Unit-testable changes** (functions, modules, classes): write a unit test that imports the actual function or module you changed. Do NOT copy-paste the implementation into the test. Cover the happy path at minimum, plus the edge cases from the plan.\n` +
		`- **Non-unit-testable changes** (config files, migrations, templates, CSS, build scripts, environment changes): write a smoke test or integration test that exercises the changed behavior end to end.\n` +
		`- **If neither is feasible** (pure documentation, environment-file changes, CI config): skip the test. State why no automated test applies and how to verify manually.\n` +
		`\n` +
		`Run all tests and confirm green before proceeding.\n` +
		`\n` +
		`**After implementation is complete and the tests pass, re-enter planning mode. Do not make any further code changes until explicitly approved.**\n` +
		`\n` +
		`### Step 7 — Review (main agent, planning mode)\n` +
		`\n` +
		`You are now in planning mode. Read and analyze only — no code changes.\n` +
		`\n` +
		`#### 7a — Get the diff\n` +
		`\n` +
		`Run \`git diff HEAD\` for uncommitted changes. If it is empty, run \`git log --oneline -10\` to find the session commits, then \`git diff <first>^..HEAD\`.\n` +
		`\n` +
		`#### 7b — Read the changed files in full\n` +
		`\n` +
		`For every file in the diff, read the complete current version (not just the hunks). Also read the callers and dependents of changed functions.\n` +
		`\n` +
		`#### 7c — Review against each criterion\n` +
		`\n` +
		`- **Correctness:** does the implementation match the plan? Logic errors, missed conditions?\n` +
		`- **Edge cases:** boundaries, empty inputs, nulls, concurrent access?\n` +
		`- **Type safety:** complete types? Hidden \`any\` casts, missing null checks?\n` +
		`- **Error handling:** at the right level? Useful messages? Silent swallowing?\n` +
		`- **Side effects:** changes outside the stated scope? Shared-state impacts?\n` +
		`- **Test coverage:** do the tests verify the described behavior? Untested paths?\n` +
		`- **Playbook alignment:** follows the established patterns?\n` +
		`- **Performance:** N+1 queries, blocking calls, memory leaks?\n` +
		`- **Security:** injection, XSS, auth bypass, secrets in code?\n` +
		`- **Naming and clarity:** descriptive? Self-documenting?\n` +
		`\n` +
		`#### 7d — Produce the review\n` +
		`\n` +
		`\`\`\`\n` +
		`VERDICT: LGTM | CHANGES_REQUESTED | NEEDS_DISCUSSION\n` +
		`RISK: Low | Medium | High\n` +
		`\n` +
		`CRITICAL:\n` +
		`- <file:line> — <issue and fix>\n` +
		`\n` +
		`WARNINGS:\n` +
		`- <file:line> — <issue and fix>\n` +
		`\n` +
		`NITS:\n` +
		`- <file:line> — <suggestion>\n` +
		`\n` +
		`POSITIVE:\n` +
		`- <things done well>\n` +
		`\n` +
		`MISSED_EDGE_CASES:\n` +
		`- <scenario not covered>\n` +
		`\`\`\`\n` +
		`\n` +
		`Omit sections with zero items.\n` +
		`\n` +
		`#### 7e — Present the review and check the verdict\n` +
		`\n` +
		`Present the review to the user.\n` +
		`\n` +
		`- **LGTM:** ask "Ready to stash?" If yes, run the Stash operation.\n` +
		`- **NEEDS_DISCUSSION:** hard stop. Wait for the user's direction. If the user says proceed, ask "Ready to stash?" If yes, run the Stash operation.\n` +
		`- **CHANGES_REQUESTED:** enter Step 8.\n` +
		`\n` +
		`### Step 8 — Revision loop (forward-only)\n` +
		`\n` +
		`Do not jump back to earlier steps. This is a self-contained loop. Repeat 8a–8d until the review verdict is LGTM or the user says stop.\n` +
		`\n` +
		`#### 8a — Re-investigate (planning mode)\n` +
		`\n` +
		`Focus on the review's critical and warning findings, not a fresh investigation. Read any additional files needed to understand the issues. Devise a targeted revision plan addressing only the findings.\n` +
		`\n` +
		`Present the revised plan. **Hard stop for approval.**\n` +
		`\n` +
		`#### 8b — Implement the revisions (act mode)\n` +
		`\n` +
		`Implement only the approved revisions. Run the type check. Run the tests. Confirm green.\n` +
		`\n` +
		`**After the tests pass, re-enter planning mode.**\n` +
		`\n` +
		`#### 8c — Re-review (planning mode)\n` +
		`\n` +
		`Read and analyze only — no code changes.\n` +
		`\n` +
		`Get the updated diff. Read the changed files in full. Review against the same criteria as Step 7c. Produce a new review in the same format as Step 7d.\n` +
		`\n` +
		`#### 8d — Present and check the verdict\n` +
		`\n` +
		`Present the re-review to the user.\n` +
		`\n` +
		`- **LGTM:** ask "Ready to stash?" If yes, run the Stash operation.\n` +
		`- **CHANGES_REQUESTED:** return to 8a.\n` +
		`- **NEEDS_DISCUSSION:** hard stop. Wait for the user's direction.\n` +
		`\n` +
		`## Manage\n` +
		`\n` +
		`View and move cards on the board, scoped to the current project.\n` +
		`\n` +
		`### Step 1 — Determine the project\n` +
		`\n` +
		`Get the project tag (see Project Tag).\n` +
		`\n` +
		`### Step 2 — Read the board\n` +
		`\n` +
		`Read \`kanban/board.md\`. Parse the content into the five columns: Backlog, Todo, In Progress, In Review, Done. Filter each column to show only lines containing \`#<project tag>\`.\n` +
		`\n` +
		`#### Reconciliation check\n` +
		`\n` +
		`Before presenting cards, verify that each card's file location matches its board column. For every card line in the filtered results, check whether the file exists in the expected folder (\`kanban/backlog/\`, \`kanban/todo/\`, \`kanban/in-progress/\`, \`kanban/in-review/\`, \`kanban/done/\`). If a file is in the wrong folder (for example the board says In Review but the file is in \`kanban/in-progress/\`), silently move it to the folder its board column names. This handles drift caused by a board editor that updates the board but does not move files.\n` +
		`\n` +
		`### Step 3 — Present cards and prompt for action\n` +
		`\n` +
		`Display the filtered board to the user in a compact format:\n` +
		`\n` +
		`\`\`\`\n` +
		`Backlog\n` +
		`  [ ] fix-login-bug — Fix login bug on mobile\n` +
		`  [ ] add-email-validation — Add email validation\n` +
		`\n` +
		`Todo\n` +
		`  [ ] redesign-header — Redesign the header\n` +
		`\n` +
		`In Progress\n` +
		`  [ ] update-api — Update the API endpoints\n` +
		`\n` +
		`In Review\n` +
		`  [ ] update-docs — Update the docs\n` +
		`\`\`\`\n` +
		`\n` +
		`If all columns are empty for this project, tell the user and stop.\n` +
		`\n` +
		`Then ask: "Which task do you want to move, and where?"\n` +
		`\n` +
		`Accept natural answers such as:\n` +
		`\n` +
		`- "move fix-login-bug to Todo"\n` +
		`- "move redesign-header to In Progress"\n` +
		`- "move update-docs to Done"\n` +
		`\n` +
		`Valid column names: \`Backlog\`, \`Todo\`, \`In Progress\`, \`In Review\`, \`Done\`.\n` +
		`\n` +
		`### Step 4 — Move the card\n` +
		`\n` +
		`#### 4a — Update the board\n` +
		`\n` +
		`In the board content:\n` +
		`\n` +
		`1. Remove the card's line from its current column.\n` +
		`2. Insert it at the bottom of the target column (just before the blank line that precedes the next \`##\` heading, or at the end of Done).\n` +
		`3. If the target is Done: change \`- [ ]\` to \`- [x]\`.\n` +
		`4. If moving out of Done: change \`- [x]\` back to \`- [ ]\`.\n` +
		`\n` +
		`Write the full board back (overwrite), preserving everything above the first column heading.\n` +
		`\n` +
		`#### 4b — Move the card file\n` +
		`\n` +
		`The card lives in the folder that matches its current column:\n` +
		`\n` +
		`- \`kanban/backlog/\` — Backlog\n` +
		`- \`kanban/todo/\` — Todo\n` +
		`- \`kanban/in-progress/\` — In Progress\n` +
		`- \`kanban/in-review/\` — In Review\n` +
		`- \`kanban/done/\` — Done\n` +
		`\n` +
		`If the source and target folders differ, move the file. Update the \`updated\` frontmatter field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`). Do not update \`created\`.\n` +
		`\n` +
		`### Step 5 — Confirm\n` +
		`\n` +
		`Tell the user: "\`<slug>\` moved to <Target Column>."\n` +
		`\n` +
		`Ask whether they want to move another card. If yes, return to Step 3. If no, stop.\n` +
		`\n` +
		`## Move\n` +
		`\n` +
		`Move the current session's card to a specified column. The card is inferred from the session. The user provides the target column inline (for example "move to todo", "move to in review").\n` +
		`\n` +
		`### Step 1 — Parse the target column\n` +
		`\n` +
		`Extract the target column from the request. Match it against the valid columns (case-insensitive):\n` +
		`\n` +
		`- \`Backlog\`\n` +
		`- \`Todo\`\n` +
		`- \`In Progress\`\n` +
		`- \`In Review\`\n` +
		`- \`Done\`\n` +
		`\n` +
		`If no target column is found in the message, ask: "Which column?"\n` +
		`\n` +
		`### Step 2 — Identify the card from session context\n` +
		`\n` +
		`Look back through the current conversation for the card being worked on this session. Signals, in priority order:\n` +
		`\n` +
		`1. A card picked through Work and moved to In Progress.\n` +
		`2. A card moved through Manage during this session.\n` +
		`3. A card file read or referenced during the session.\n` +
		`\n` +
		`Use the slug (the name on the board) and the current folder the card lives in.\n` +
		`\n` +
		`If no card can be identified, tell the user and stop.\n` +
		`\n` +
		`### Step 3 — Determine the project\n` +
		`\n` +
		`Get the project tag (see Project Tag).\n` +
		`\n` +
		`### Step 4 — Read the board\n` +
		`\n` +
		`Read \`kanban/board.md\`.\n` +
		`\n` +
		`Locate the card's line on the board. If it is not found, tell the user and stop.\n` +
		`\n` +
		`If the card is already in the target column, tell the user and stop.\n` +
		`\n` +
		`### Step 5 — Move the card\n` +
		`\n` +
		`#### 5a — Update the board\n` +
		`\n` +
		`In the board content:\n` +
		`\n` +
		`1. Remove the card line from its current column.\n` +
		`2. Insert it at the bottom of the target column (just before the blank line that precedes the next \`##\` heading, or at the end of Done).\n` +
		`3. If the target is Done: change \`- [ ]\` to \`- [x]\`.\n` +
		`4. If moving out of Done: change \`- [x]\` back to \`- [ ]\`.\n` +
		`\n` +
		`Write the full board back (overwrite), preserving everything above the first column heading.\n` +
		`\n` +
		`#### 5b — Move the card file\n` +
		`\n` +
		`The card lives in the folder that matches its current column:\n` +
		`\n` +
		`- \`kanban/backlog/\` — Backlog\n` +
		`- \`kanban/todo/\` — Todo\n` +
		`- \`kanban/in-progress/\` — In Progress\n` +
		`- \`kanban/in-review/\` — In Review\n` +
		`- \`kanban/done/\` — Done\n` +
		`\n` +
		`If the source and target folders differ, move the file. Update the \`updated\` frontmatter field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).\n` +
		`\n` +
		`### Step 6 — Confirm\n` +
		`\n` +
		`Tell the user: "\`<slug>\` moved to <Target Column>."\n` +
		`\n` +
		`## Complete\n` +
		`\n` +
		`Move the current session's card to In Review (the default) or to Done (when the user passes \`--done\` or asks for Done).\n` +
		`\n` +
		`### Step 1 — Parse flags\n` +
		`\n` +
		`Check whether \`--done\` was passed.\n` +
		`\n` +
		`- No flag (default): the target column is **In Review**.\n` +
		`- \`--done\`: the target column is **Done**.\n` +
		`\n` +
		`### Step 2 — Identify the card from session context\n` +
		`\n` +
		`Look back through the current conversation for the card that was worked on this session. Signals: a card picked through Work, a card moved to In Progress through Manage, or a card file read or referenced during the session.\n` +
		`\n` +
		`If no card was worked on this session, tell the user there is nothing to complete and stop.\n` +
		`\n` +
		`### Step 3 — Determine the project\n` +
		`\n` +
		`Get the project tag (see Project Tag).\n` +
		`\n` +
		`### Step 4 — Read the board\n` +
		`\n` +
		`Read \`kanban/board.md\`.\n` +
		`\n` +
		`Locate the card's line on the board. It could be in any column (Backlog, Todo, In Progress, In Review). If it is not found, tell the user and stop.\n` +
		`\n` +
		`### Step 5 — Move the card\n` +
		`\n` +
		`#### 5a — Update the board\n` +
		`\n` +
		`In the board content:\n` +
		`\n` +
		`1. Remove the card line from its current column.\n` +
		`2. If the target is In Review: insert it at the bottom of the \`## In Review\` section (keep \`- [ ]\` unchanged).\n` +
		`3. If the target is Done: insert it at the bottom of the \`## Done\` section, changing \`- [ ]\` to \`- [x]\`.\n` +
		`\n` +
		`Write the full board back (overwrite), preserving everything above the first column heading.\n` +
		`\n` +
		`#### 5b — Move the card file\n` +
		`\n` +
		`- If the target is Done: move the file from its current folder to \`kanban/done/<slug>.md\`.\n` +
		`- If the target is In Review: move the file from its current folder to \`kanban/in-review/<slug>.md\`.\n` +
		`\n` +
		`Update the \`updated\` frontmatter field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).\n` +
		`\n` +
		`### Step 6 — Confirm\n` +
		`\n` +
		`Tell the user the card was moved to In Review (or to Done if \`--done\` was used).\n` +
		`\n` +
		`## Stash\n` +
		`\n` +
		`Stash session context into the current card: what changed, decisions made, open questions and remaining work. Use this at the end of a session, or at any point mid-session, to persist everything learned so a future session can pick up seamlessly.\n` +
		`\n` +
		`### Step 1 — Identify the card from session context\n` +
		`\n` +
		`Look back through the current conversation for the card that was worked on this session. Signals: a card picked through Work, a card moved to In Progress through Manage, or a card file read or referenced during the session.\n` +
		`\n` +
		`If no card can be identified, ask the user which card to stash to and stop until they answer.\n` +
		`\n` +
		`### Step 2 — Determine the project\n` +
		`\n` +
		`Get the project tag (see Project Tag).\n` +
		`\n` +
		`### Step 3 — Read the card\n` +
		`\n` +
		`Read the card to see which sections already exist (Investigation, Answers, Solution, Revisions, earlier Stash entries). You need to know the current state so you do not duplicate information.\n` +
		`\n` +
		`### Step 4 — Gather session context\n` +
		`\n` +
		`Collect information from these sources, in parallel where possible.\n` +
		`\n` +
		`#### 4a — Git changes (if in a git repo)\n` +
		`\n` +
		`Run \`git diff --stat\` and \`git log --oneline -10\` to see which files changed and which commits were made during this session. If there are uncommitted changes, record them.\n` +
		`\n` +
		`#### 4b — Conversation review\n` +
		`\n` +
		`Review the conversation for:\n` +
		`\n` +
		`- **What was done:** concrete changes made (files modified, new behavior added, bugs fixed, refactors performed). Be specific: name files, functions and what changed.\n` +
		`- **Key decisions:** choices made and why. Include the alternatives that were considered and rejected, and the reasoning. This is the most valuable part: a future session needs to know not just what was chosen but why the alternatives lost.\n` +
		`- **Open questions:** anything unresolved, unclear or deferred. Things that need more investigation or user input, or that depend on external factors.\n` +
		`- **Remaining work:** what is left to do to complete the card. Be concrete: name specific files, functions or steps. If there is a rough order, give it.\n` +
		`- **Gotchas and surprises:** anything unexpected discovered during the session that future sessions should know about (weird behavior, undocumented constraints, things that look like bugs but are not).\n` +
		`\n` +
		`### Step 5 — Compose and append the stash entry\n` +
		`\n` +
		`Append a \`## Stash\` section to the card. If a \`## Stash\` section already exists (from a prior session), append a new dated subsection under it — do NOT overwrite prior stash entries.\n` +
		`\n` +
		`Format:\n` +
		`\n` +
		`\`\`\`markdown\n` +
		`## Stash\n` +
		`\n` +
		`### <YYYY-MM-DD HH:MM>\n` +
		`\n` +
		`**Changes made:**\n` +
		`- <file or area>: <what changed and why>\n` +
		`\n` +
		`**Decisions:**\n` +
		`- <decision>: <reasoning, alternatives considered>\n` +
		`\n` +
		`**Open questions:**\n` +
		`- <question or uncertainty>\n` +
		`\n` +
		`**Remaining work:**\n` +
		`- [ ] <concrete next step>\n` +
		`\n` +
		`**Gotchas:**\n` +
		`- <anything surprising or non-obvious>\n` +
		`\`\`\`\n` +
		`\n` +
		`Omit any section that has no content (for example, if there are no gotchas, skip that heading). Do not pad with filler: every line should carry information.\n` +
		`\n` +
		`If a \`## Stash\` section already exists, append the new entry as a new \`###\` dated subsection at the bottom of the existing Stash section:\n` +
		`\n` +
		`\`\`\`markdown\n` +
		`### <YYYY-MM-DD HH:MM>\n` +
		`\n` +
		`**Changes made:**\n` +
		`...\n` +
		`\`\`\`\n` +
		`\n` +
		`### Step 6 — Update frontmatter\n` +
		`\n` +
		`Update the card's \`updated\` field to the current datetime (\`YYYY-MM-DDTHH:MM:SS\`).\n` +
		`\n` +
		`### Step 7 — Confirm\n` +
		`\n` +
		`Tell the user the stash was saved. Show a brief summary of what was recorded (one line per section that was included). If there are open questions or remaining work items, highlight them so the user is aware of loose ends.\n` +
		`\n` +
		`## Review\n` +
		`\n` +
		`Spin up a subagent to do a comprehensive code review of the changes made for the current session's card. If changes are requested, run the full investigate, plan, approve, implement cycle through subagents.\n` +
		`\n` +
		`The point of this operation is to offload work from the main agent's context. Do as little as possible yourself and pass the context you already have to subagents. Do NOT read the card, search the brain or gather project context yourself.\n` +
		`\n` +
		`### Delegation rules\n` +
		`\n` +
		`1. Never read the card, diffs or code yourself. Every read operation happens inside a subagent call.\n` +
		`2. Execute the steps in strict order. Complete each step's subagent call and fully process its output before starting the next step.\n` +
		`3. Hard stops are mandatory. Where marked HARD STOP, you MUST stop and wait for user input.\n` +
		`4. Pass context forward explicitly. Each subagent call is stateless, so include all needed context (paths, slugs, diffs, review findings) in the prompt.\n` +
		`5. Every subagent call needs three things: a type (\`read-only\` for exploration, or \`general-purpose\` for full access), a short description for the UI (5–10 words), and the full prompt the subagent receives.\n` +
		`6. Planning mode must be off. If a read-only planning mode is active, turn it off before starting Step 1. This operation has its own approval gates, and planning mode adds redundant friction that breaks subagent write operations.\n` +
		`7. Ask with structured options at every HARD STOP. Whenever a HARD STOP presents the user with choices, ask with structured multiple-choice options. Do not dump plain text and wait. Only the main agent can ask the user.\n` +
		`\n` +
		`### Step 1 — Run the review\n` +
		`\n` +
		`You already know the card path, diff range and working directory from the current conversation. Pass them directly into the subagent prompt. If the user's request contains a commit range or branch, use that as the diff range.\n` +
		`\n` +
		`If no card can be identified from conversation context, ask the user which card to review and **HARD STOP until they answer**.\n` +
		`\n` +
		`Make one subagent call (type \`read-only\`, description "Code review for \`<TASK_SLUG>\`") with this prompt, filled in:\n` +
		`\n` +
		`> You are performing a comprehensive code review.\n` +
		`> **You are read-only — do not write, patch, move or update any files or card content.**\n` +
		`>\n` +
		`> **Card path:** \`<path>\`\n` +
		`> **Diff range:** \`<range, or "uncommitted changes">\`\n` +
		`> **Working directory:** \`<pwd>\`\n` +
		`>\n` +
		`> ## MANDATORY FIRST STEP — do this before anything else\n` +
		`>\n` +
		`> Invoke the \`study-playbook\` skill and read everything it returns. Follow every convention it specifies when evaluating code. If the playbook references a project-level \`CLAUDE.md\`, read that too (check the working directory root). If the skill is unavailable, read the project's \`CLAUDE.md\`; if neither exists, proceed without conventions and say so in the review.\n` +
		`>\n` +
		`> ## Review checklist\n` +
		`>\n` +
		`> Follow this checklist in order:\n` +
		`>\n` +
		`> - [ ] **Read the coding playbook** (above — not optional, do it first).\n` +
		`> - [ ] **Gather context**\n` +
		`>   - Read the card at \`<card path>\`. Extract the description, investigation, plan, solution, stash and revisions sections.\n` +
		`>   - Get the diff: run \`git diff HEAD\` for uncommitted changes. If empty, run \`git log --oneline -20\` to find the session commits, then \`git diff <first-commit>^..HEAD\`. If a specific range was provided, use that.\n` +
		`>   - If the card contains a \`## Stash\` section, read the latest entry — it represents the most current session state (changes made, decisions, gotchas). Factor this into your review.\n` +
		`> - [ ] **Read the changed files in full.** For every file in the diff, read the complete current version (not just the diff hunks) so you have surrounding context. Also read the callers and dependents of changed functions.\n` +
		`> - [ ] **Review against each criterion:**\n` +
		`>   - **Correctness:** does the implementation match the plan and the card description? Logic errors, off-by-one, missed conditions?\n` +
		`>   - **Edge cases:** boundary conditions, empty inputs, null values, concurrent access, unexpected states?\n` +
		`>   - **Type safety:** correct and complete types? Any \`any\` casts, missing null checks at boundaries, type assertions hiding problems?\n` +
		`>   - **Error handling:** errors caught at the right level? Useful messages? Silent swallowing?\n` +
		`>   - **Side effects:** changes outside the stated scope? Check callers, dependents and shared state.\n` +
		`>   - **Test coverage:** do the tests verify the described behavior? Untested paths? Do the tests import the real module (not copy-pasted logic)?\n` +
		`>   - **Playbook alignment:** do the changes follow the established patterns from the coding playbook?\n` +
		`>   - **Performance:** N+1 queries, unnecessary re-renders, blocking calls, memory leaks?\n` +
		`>   - **Security:** OWASP top 10 — injection, XSS, auth bypass, secrets in code?\n` +
		`>   - **Naming and clarity:** descriptive names? Self-documenting code? Intent clear without comments?\n` +
		`> - [ ] **Produce the review** in this exact format:\n` +
		`>\n` +
		`> \`\`\`\n` +
		`> ## Review Summary\n` +
		`>\n` +
		`> **Verdict:** LGTM | Changes Requested | Needs Discussion\n` +
		`>\n` +
		`> **Risk level:** Low | Medium | High\n` +
		`>\n` +
		`> ### Findings\n` +
		`>\n` +
		`> #### Critical (must fix)\n` +
		`> - [ ] <file:line> — <issue and suggested fix>\n` +
		`>\n` +
		`> #### Warnings (should fix)\n` +
		`> - [ ] <file:line> — <issue and suggested fix>\n` +
		`>\n` +
		`> #### Nits (optional)\n` +
		`> - [ ] <file:line> — <suggestion>\n` +
		`>\n` +
		`> #### Positive\n` +
		`> - <things done well — reinforce good patterns>\n` +
		`>\n` +
		`> ### Missed Edge Cases\n` +
		`> - <scenario not covered by tests or code>\n` +
		`>\n` +
		`> ### Questions\n` +
		`> - <anything ambiguous that needs the author's input>\n` +
		`> \`\`\`\n` +
		`>\n` +
		`> Omit any section that has zero items. Every finding must reference a specific file and line number.\n` +
		`\n` +
		`Wait for the subagent result. Then proceed to Step 2.\n` +
		`\n` +
		`### Step 2 — Present the review\n` +
		`\n` +
		`Display the full review output verbatim. Do not summarize, editorialize or filter.\n` +
		`\n` +
		`### Step 3 — Record the review\n` +
		`\n` +
		`Make one subagent call (\`general-purpose\`, description "Record review on \`<TASK_SLUG>\`") with this prompt, filled in:\n` +
		`\n` +
		`> You are recording a code review on a card.\n` +
		`>\n` +
		`> **Card path:** \`<card path>\`\n` +
		`> **Now:** \`<YYYY-MM-DDTHH:MM:SS>\`\n` +
		`>\n` +
		`> Use only the brain read, append, write and frontmatter tools available in this session.\n` +
		`>\n` +
		`> - [ ] Read the current card.\n` +
		`> - [ ] If a \`## Review\` section already exists, append a new dated subsection under it (do NOT overwrite prior reviews). Otherwise, append a new \`## Review\` section.\n` +
		`> - [ ] Append:\n` +
		`>\n` +
		`> \`\`\`markdown\n` +
		`> ### <YYYY-MM-DD HH:MM>\n` +
		`>\n` +
		`> **Verdict:** <verdict>\n` +
		`> **Risk level:** <risk level>\n` +
		`>\n` +
		`> **Key findings:**\n` +
		`> <critical and warning items only — skip nits>\n` +
		`>\n` +
		`> **Action taken:** <pending user decision>\n` +
		`> \`\`\`\n` +
		`>\n` +
		`> - [ ] Update the frontmatter to set \`updated\`.\n` +
		`> - [ ] Return: \`DONE\`\n` +
		`\n` +
		`Wait for \`DONE\`.\n` +
		`\n` +
		`### Step 4 — Fix cycle (only if changes were requested)\n` +
		`\n` +
		`If the verdict is **LGTM**, stop here. You are done.\n` +
		`\n` +
		`If the verdict is **Changes Requested** or **Needs Discussion**, ask the user: "Want me to implement the fixes?"\n` +
		`\n` +
		`**HARD STOP until they answer.**\n` +
		`\n` +
		`If the user says yes, run Steps 4a through 4d below. You are an orchestrator: delegate every step to subagents.\n` +
		`\n` +
		`#### 4a — Investigate the findings\n` +
		`\n` +
		`Make one subagent call (type \`read-only\`, description "Investigate review findings for \`<TASK_SLUG>\`") with this prompt, filled in:\n` +
		`\n` +
		`> You are re-investigating a card after a code review found issues.\n` +
		`> **You are read-only — do NOT write, patch, move or update anything.**\n` +
		`>\n` +
		`> **Card path:** \`<path>\` | **Slug:** \`<TASK_SLUG>\` | **Project:** \`<project tag>\`\n` +
		`> **Working directory:** \`<pwd>\`\n` +
		`>\n` +
		`> Use only the brain read and search tools available in this session.\n` +
		`>\n` +
		`> ## MANDATORY FIRST STEP — do this before anything else\n` +
		`>\n` +
		`> Invoke the \`study-playbook\` skill and read everything it returns. Follow every convention it specifies. If the playbook references a project-level \`CLAUDE.md\`, read that too. If the skill is unavailable, read the project's \`CLAUDE.md\`; if neither exists, proceed without conventions and say so.\n` +
		`>\n` +
		`> ## Review findings to address\n` +
		`>\n` +
		`> \`<paste the full review findings: Critical + Warnings + Missed Edge Cases>\`\n` +
		`>\n` +
		`> ## Checklist\n` +
		`>\n` +
		`> - [ ] **Read the coding playbook** (above — not optional, do it first).\n` +
		`> - [ ] **Read the card.** Get full context, including investigation, plan, solution, stash and prior reviews.\n` +
		`> - [ ] **Investigate each finding.** Read every file referenced in the review findings (full files). Search for call sites of functions that need to change. Verify each finding is valid (not a false positive).\n` +
		`> - [ ] **Devise the fix plan.** For each confirmed finding:\n` +
		`>   - name the file, the function or block, and what changes;\n` +
		`>   - flag any side effects or downstream impacts;\n` +
		`>   - output as a **structured checklist**.\n` +
		`> - [ ] **Return in this exact format:**\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   INVESTIGATION:\n` +
		`>   - **Validated findings:** <which review items are confirmed>\n` +
		`>   - **False positives:** <which items are not actually issues, with reasoning>\n` +
		`>   - **Files involved:** <each file + one-line reason>\n` +
		`>\n` +
		`>   OPEN_QUESTIONS:\n` +
		`>   <bulleted list, or "None">\n` +
		`>\n` +
		`>   PLAN:\n` +
		`>   <structured checklist of fixes>\n` +
		`>   \`\`\`\n` +
		`\n` +
		`Wait for the subagent result. Parse out INVESTIGATION, OPEN_QUESTIONS and PLAN.\n` +
		`\n` +
		`#### 4b — Present the plan and handle open questions\n` +
		`\n` +
		`If there are open questions, present them. **HARD STOP until every question is answered or dismissed.**\n` +
		`\n` +
		`Present the PLAN verbatim.\n` +
		`\n` +
		`**HARD STOP: "Plan ready — approve to proceed?"** Do not implement until approved.\n` +
		`\n` +
		`#### 4c — Implement the fixes\n` +
		`\n` +
		`Once approved, make one subagent call (\`general-purpose\`, description "Implement review fixes for \`<TASK_SLUG>\`") with this prompt, filled in:\n` +
		`\n` +
		`> You are implementing review fixes from an approved plan.\n` +
		`>\n` +
		`> **Card path:** \`<path>\` | **Slug:** \`<TASK_SLUG>\`\n` +
		`> **Working directory:** \`<pwd>\` | **Now:** \`<YYYY-MM-DDTHH:MM:SS>\`\n` +
		`>\n` +
		`> Use only the brain append and frontmatter tools available in this session.\n` +
		`>\n` +
		`> ## MANDATORY FIRST STEP — do this before writing any code\n` +
		`>\n` +
		`> Invoke the \`study-playbook\` skill and read everything it returns. Then check whether a \`CLAUDE.md\` exists at the working directory root — if so, read that too. Follow every convention from both for all code you write. If the skill is unavailable and there is no \`CLAUDE.md\`, proceed without conventions and say so.\n` +
		`>\n` +
		`> ## Approved plan\n` +
		`>\n` +
		`> \`<paste the full PLAN here>\`\n` +
		`>\n` +
		`> \`<if open questions were answered, paste them here under "## User answers">\`\n` +
		`>\n` +
		`> ## Checklist\n` +
		`>\n` +
		`> - [ ] **Read the coding playbook and the project \`CLAUDE.md\`** (above — mandatory).\n` +
		`> - [ ] **Implement the fixes.** Follow the approved plan step by step. Follow every convention from the playbook.\n` +
		`> - [ ] **Type check.** Run the project's type checker. Fix all errors before proceeding.\n` +
		`> - [ ] **Run tests.** Run the existing tests. If any review finding relates to untested behavior, add tests. All tests must pass before proceeding.\n` +
		`> - [ ] **Record revisions.** Append a \`## Revisions\` section to the card. If a \`## Revisions\` section already exists, append a new dated subsection (do NOT overwrite prior revisions):\n` +
		`>\n` +
		`>   \`\`\`markdown\n` +
		`>   ### <YYYY-MM-DD HH:MM>\n` +
		`>\n` +
		`>   **Review findings addressed:** <which items were fixed>\n` +
		`>   **Files changed:** <each file + one-line summary>\n` +
		`>   **Test coverage:** <tests added/modified and what they verify>\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`>   Then update the frontmatter to set \`updated\`.\n` +
		`>\n` +
		`> - [ ] **Return in this exact format:**\n` +
		`>\n` +
		`>   \`\`\`\n` +
		`>   SUMMARY:\n` +
		`>   <files modified and what each change does>\n` +
		`>\n` +
		`>   TEST_RESULTS:\n` +
		`>   <tests added/modified, what they verify, pass/fail>\n` +
		`>\n` +
		`>   FILES_CHANGED:\n` +
		`>   <bulleted list of every file modified or created>\n` +
		`>   \`\`\`\n` +
		`>\n` +
		`> **Do NOT commit. No git add, git commit or any git write operations.**\n` +
		`\n` +
		`Wait for the subagent result. Then proceed to Step 4d.\n` +
		`\n` +
		`#### 4d — Present results\n` +
		`\n` +
		`Display \`SUMMARY\`, \`TEST_RESULTS\` and \`FILES_CHANGED\` verbatim.\n` +
		`\n` +
		`**Do NOT commit or stage anything.** Wait for an explicit user request.\n` +
		`\n` +
		`To review again, run the Review operation again.\n` +
		`\n` +
		`## Reaching the Board\n` +
		`\n` +
		`Read and write the board and the cards only with the brain read and write tools available in this session. Never assume a storage backend, and never bypass those tools: no native file reads or writes, no shell listing, no direct editing of files on disk.\n` +
		`\n` +
		`Every operation in this guide needs only these capabilities from the brain tools:\n` +
		`\n` +
		`| Capability | Used for |\n` +
		`| ---------- | -------- |\n` +
		`| read a file by its brain-relative path | the board, a card |\n` +
		`| write a file (overwrite) | creating a card, rewriting the whole board |\n` +
		`| append to a file | adding a Stash, Review or Revisions entry to a card |\n` +
		`| move a file | moving a card to another column folder |\n` +
		`| read and update frontmatter | \`updated\`, \`sessions\` |\n` +
		`| search | finding a card by slug or name, domain context |\n` +
		`\n` +
		`All paths are brain-relative. If the brain tools are not available in this session, stop and tell the user. Do not improvise with another route to the files.\n` +
		`\n` +
		`<!-- aide-work-kanban-end -->`
	);
}
