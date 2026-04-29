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
 * including the post-sync entry-point artifact seeding step.
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
 *    `/aide:brain config`. Describes how to read `brain.aide`, detect YAML null
 *    at the last entry of `mcpServerConfig.args` as the unwired-state signal,
 *    decide the target path (from `$ARGUMENTS`, interactively, or STOP if already
 *    wired), edit `brain.aide` to replace null with the absolute path, run sync
 *    via the agent's Bash tool, seed the four entry-point artifacts via
 *    `mcp__brain__write_note`, and emit the restart message. Read live by
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
 *   The orientation and config sections have no headings.
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
		`5. **Seed the four entry-point artifacts into the brain via the brain MCP tools.**\n` +
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
		`   When the brain MCP tools ARE available, for each artifact below: presence-check\n` +
		`   via \`mcp__brain__list_directory\` (or read tool) at the named path; if absent,\n` +
		`   write it via \`mcp__brain__write_note\` using the seed bytes from brain.aide's\n` +
		`   corresponding section (read via parseBrainAide's typed keys):\n` +
		`   - \`playbookIndex\` → \`coding-playbook/coding-playbook.md\`\n` +
		`   - \`studyPlaybook\` → \`coding-playbook/study-playbook.md\`\n` +
		`   - \`updatePlaybook\` → \`coding-playbook/update-playbook.md\`\n` +
		`   - \`researchIndex\` → \`research/research.md\`\n` +
		`   Skip any artifact that already exists (presence-only check — do not overwrite\n` +
		`   user-edited content).\n` +
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
