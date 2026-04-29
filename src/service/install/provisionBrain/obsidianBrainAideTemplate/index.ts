import { platform } from "node:os";

/**
 * Returns the complete canonical bundled `brain.aide` file content as a string,
 * ready to write to disk at `.aide/config/brain.aide` in the host project root.
 *
 * The returned string has six body sections in this order:
 *
 * 1. **`<!-- aide-orientation-start -->`** — Agent-facing runtime briefing for navigating
 *    the brain. Names the `mcp__brain__read_note` and `mcp__brain__search_notes`
 *    tools and describes how to follow linked files, including the four
 *    entry-point artifacts at `coding-playbook/coding-playbook.md`,
 *    `coding-playbook/study-playbook.md`, `coding-playbook/update-playbook.md`,
 *    and `research/research.md`. Read live by `aide_brain` at runtime.
 *    User-editable post-scaffold.
 *
 * 2. **`<!-- aide-config-start -->`** — Integration-specific wiring flow for
 *    `/aide:brain config`. Describes how to read `brain.aide`, decide the target
 *    vault path (from `$ARGUMENTS`, interactively, or STOP if already wired),
 *    edit `brain.aide`, sync, and emit the restart message. Read live by
 *    `aide_brain({ kind: "config" })` at runtime. User-editable post-scaffold.
 *
 * 3. **`<!-- aide-playbook-index-start -->`** — Seed bytes for the coding-playbook
 *    entry-point file scaffolded into the user's brain on cold install
 *    (`coding-playbook/coding-playbook.md`). Structural scaffolding plus universal
 *    navigation doctrine: intro paragraph, Task Routing (table skeleton with
 *    instructional preamble), How to Use This Index (with nested Always Read First
 *    placeholder references), Sections, Prime Examples, and Contents. Install-time
 *    seed only — read once by the install service. User-editable post-scaffold.
 *
 * 4. **`<!-- aide-study-playbook-start -->`** — Seed bytes for the study-playbook
 *    entry-point file scaffolded into the user's brain on cold install
 *    (`coding-playbook/study-playbook.md`). Contains the multi-month-tested navigation
 *    methodology: the Step 1/2/3 process, Navigation Rules with depth-counting example,
 *    link-traversal semantics, never-re-read rule, and stay-in-scope rule. Install-time
 *    seed only — read once by the install service. User-editable post-scaffold.
 *
 * 5. **`<!-- aide-update-playbook-start -->`** — Seed bytes for the playbook-maintenance
 *    methodology file scaffolded into the user's brain on cold install
 *    (`coding-playbook/update-playbook.md`). Contains the identify-read-apply-drift-
 *    check-confirm methodology with routing-table drift detection. Install-time seed
 *    only — read once by the install service. The shipped `/aide:update-playbook`
 *    command points at this on-disk artifact after install (same pointer pattern as
 *    the `study-playbook` skill). User-editable post-scaffold.
 *
 * 6. **`<!-- aide-research-index-start -->`** — Seed bytes for the research entry-point
 *    file scaffolded into the user's brain on cold install (`research/research.md`).
 *    Install-time seed only — read once by the install service. User-editable
 *    post-scaffold.
 *
 * Load-bearing constraints:
 * - Frontmatter is exactly `name` + `mcpServerConfig` — minimum schema is the
 *   maximum schema. The parser rejects any additional top-level field as
 *   `malformed-frontmatter`.
 * - When `brainPath` is provided, it is inlined byte-for-byte as the last element
 *   of `args`. When `brainPath` is omitted, the literal string `<BRAIN_PATH>` is
 *   substituted in the same position. The placeholder is a parser-blind literal —
 *   not a `${...}` interpolation target — so `interpolateArgs` passes it through
 *   unchanged. The user supplies the real path later via `/aide:brain config`.
 * - Platform branching: Windows uses `command: cmd` with `["/c", "npx", ...]`
 *   args to work around Windows shell constraints. POSIX uses `command: npx`
 *   directly. The platform check is isolated here and nowhere else in this module.
 * - Heading levels: the playbook-index and study-playbook sections use `## ` for
 *   top-level sub-sections under their `# ` title, since these sections are seeded
 *   into standalone files where `## ` is the natural sub-heading level. The
 *   update-playbook section uses `## ` sub-sections under `# Update Playbook`.
 *   The research-index section keeps `### ` only (its top-level structure is shallow).
 *   The orientation and config sections have no headings.
 * - Retired marker names (`aide-prose-*`, `aide-playbook-*` without `-index`,
 *   `aide-research-*` without `-index`) are gone. The parser treats them as plain
 *   bytes and returns `malformed-body` (missing markers) for any brain.aide that
 *   still uses the old four-section grammar.
 */
export default function obsidianBrainAideTemplate(brainPath?: string): string {
	const pathArg = brainPath !== undefined ? brainPath : "<BRAIN_PATH>";

	const mcpServerConfig =
		platform() === "win32"
			? `mcpServerConfig:\n  command: cmd\n  args:\n    - '/c'\n    - 'npx'\n    - '@bitbonsai/mcpvault'\n    - '${pathArg}'`
			: `mcpServerConfig:\n  command: npx\n  args:\n    - '@bitbonsai/mcpvault'\n    - '${pathArg}'`;

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
		`<!-- aide-orientation-end -->\n` +
		`\n` +
		`<!-- aide-config-start -->\n` +
		`\n` +
		`You are completing the wiring of an Obsidian brain. The required value is the\n` +
		`absolute path to the user's Obsidian vault, landed as the last entry of\n` +
		`\`mcpServerConfig.args\` in \`brain.aide\`.\n` +
		`\n` +
		`Argument shape (Obsidian only): \`/aide:brain config [<absolute-path>]\`. When\n` +
		`\`$ARGUMENTS\` is non-empty, treat it as the absolute path the user wants to wire\n` +
		`(initial wiring) or re-wire to (re-point). Empty \`$ARGUMENTS\` means "ask\n` +
		`interactively" on a fresh wire and "STOP, nothing to do" against an already-wired\n` +
		`brain.\n` +
		`\n` +
		`1. Read \`brain.aide\`. Extract the current path entry from \`mcpServerConfig.args\`\n` +
		`   (the literal \`<BRAIN_PATH>\` placeholder means un-wired; any other string means\n` +
		`   already wired).\n` +
		`2. Decide the target path:\n` +
		`   - \`$ARGUMENTS\` non-empty → use it as the target path.\n` +
		`   - \`$ARGUMENTS\` empty AND current entry is \`<BRAIN_PATH>\` → ask the user where\n` +
		`     their vault lives. Use \`AskUserQuestion\` with \`aide_info.brain.hints\` as\n` +
		`     suggestions plus a "Different location" entry.\n` +
		`   - \`$ARGUMENTS\` empty AND current entry is a real path → STOP, nothing to do.\n` +
		`3. Edit \`brain.aide\` — replace the current entry with the target path.\n` +
		`4. Sync — read \`.mcp.json["mcpServers"]["aide"]\`, take its command and args, append\n` +
		`   \`"sync"\`, run via Bash. On exit 0 continue; on non-zero surface stderr and stop.\n` +
		`5. Emit the restart message verbatim: "Sync wrote the brain entry. Restart Claude\n` +
		`   Code so the brain MCP server picks up the new entry, then re-run /aide."\n` +
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
		`Maintenance methodology for the coding playbook. Use \`mcp__brain__read_note\` to read\n` +
		`entries, \`mcp__brain__patch_note\` or \`mcp__brain__write_note\` to edit them. Playbook\n` +
		`entries live under \`coding-playbook/<section>/\`; the index sits at\n` +
		`\`coding-playbook/coding-playbook.md\`.\n` +
		`\n` +
		`1. Identify the change — new convention, modification to an existing one, section\n` +
		`   rename, section removal, or general audit. Skip this step if the user already\n` +
		`   named the change.\n` +
		`2. Read \`coding-playbook/coding-playbook.md\` to identify the relevant section, or\n` +
		`   confirm no section yet exists for a new convention.\n` +
		`3. Apply the change with \`mcp__brain__patch_note\` or \`mcp__brain__write_note\`. If a\n` +
		`   section was added, renamed, or removed, offer to reorganize adjacent sections under\n` +
		`   a new or updated domain grouping if it would improve navigability.\n` +
		`4. **Routing-table drift check (required):** Compare the playbook entry-point's task\n` +
		`   routing table against the actual sections that now exist. For each row: does the\n` +
		`   section it points to still exist under that name? For each section: does the routing\n` +
		`   table cover it? Offer to reconcile any drift.\n` +
		`5. Apply any routing-table changes the user approves. Confirm the final state — what\n` +
		`   was changed in the playbook, what was changed in the routing table.\n` +
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
		`<!-- aide-research-index-end -->`
	);
}
